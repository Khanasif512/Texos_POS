import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { AppError, businessRule, forbidden, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import { assertBranch, can, type TenantContext } from "@/server/auth/context"
import { dec, num, round2 } from "@/server/decimal"
import { issueStockFIFO, restoreToBatches } from "@/server/modules/inventory/stock"
import { postCustomerLedger } from "@/server/modules/ledger/service"
import { nextNumber } from "@/server/modules/common/sequence"
import { money } from "@/lib/format"
import type { ChallanUpdateOutput, InvoiceOutput } from "@/lib/validation/sales"
import { cancelWindow, cancelWindowHours, checkCreditLimit, computeTotals, lineCost, SalesCalcError } from "./calc"

const TX_OPTS = { timeout: 30_000, maxWait: 10_000 }

/** Users without sales.view_all only see invoices they sold or created (SLS-09). */
export function invoiceScope(ctx: TenantContext): Prisma.InvoiceWhereInput {
  if (can(ctx, "sales.view_all")) return {}
  return { OR: [{ salesmanId: ctx.userId }, { createdById: ctx.userId }] }
}

function validation(message: string, field?: string): AppError {
  return new AppError("VALIDATION_ERROR", message, field ? { fields: { [field]: message } } : undefined)
}

// ───────── Create (SLS-01, SLS-02, SLS-03, CRM-01) ─────────

export type CreatedInvoice = {
  id: string
  number: string
  type: "cash" | "credit"
  total: number
  paidAmount: number
  dueAmount: number
  challanId: string
  challanNumber: string
  receiptNumber: string | null
  creditOverride: boolean
}

export async function createInvoice(ctx: TenantContext, input: InvoiceOutput): Promise<CreatedInvoice> {
  const companyId = ctx.companyId
  assertBranch(ctx, input.branchId)
  const branch = await prisma.branch.findFirst({ where: { id: input.branchId, companyId, status: "active" } })
  if (!branch) throw notFound("Branch")

  let totals: ReturnType<typeof computeTotals>
  try {
    totals = computeTotals(input)
  } catch (e) {
    if (e instanceof SalesCalcError) throw validation(e.message, e.field)
    throw e
  }
  const mayDiscount = can(ctx, "sales.discount")
  if (totals.totalDiscount.gt(0) && !mayDiscount) throw forbidden("You are not allowed to give discounts")

  // products
  const ids = [...new Set(input.lines.map((l) => l.variationId))]
  const variations = await prisma.productVariation.findMany({
    where: { id: { in: ids }, companyId },
    include: { product: { select: { name: true, unit: true, status: true } } },
  })
  if (variations.length !== ids.length) throw validation("One or more products were not found")
  const varMap = new Map(variations.map((v) => [v.id, v]))
  const inactive = variations.find((v) => v.status !== "active" || v.product.status !== "active")
  if (inactive) throw businessRule(`${inactive.product.name} — ${inactive.name} is inactive and cannot be sold`)

  // customer
  const customer = input.customerId ? await prisma.customer.findFirst({ where: { id: input.customerId, companyId } }) : null
  if (input.customerId && !customer) throw notFound("Customer")
  if (customer && customer.status !== "active") throw businessRule(`${customer.name} is inactive`)
  if (input.type === "credit" && !customer) throw validation("Credit invoices need a customer", "customerId")

  // salesman (SLS-09)
  const salesmanId = input.salesmanId ?? ctx.userId
  if (salesmanId !== ctx.userId) {
    const sm = await prisma.user.findFirst({ where: { id: salesmanId, companyId, status: "active" }, select: { id: true } })
    if (!sm) throw validation("Choose a valid salesman", "salesmanId")
  }

  // quotation / order being converted
  const order = input.salesOrderId
    ? await prisma.salesOrder.findFirst({ where: { id: input.salesOrderId, companyId }, include: { lines: true } })
    : null
  if (input.salesOrderId && !order) throw notFound("Sales order")
  if (order) {
    if (order.status !== "open") throw businessRule(`${order.number} is already ${order.status}`)
    assertBranch(ctx, order.branchId)
  }

  // price floor for users who may not discount: list price (wholesale price for wholesale/dealer customers) or the quoted price
  if (!mayDiscount) {
    for (const l of input.lines) {
      const v = varMap.get(l.variationId)!
      let floor = dec(v.salePrice)
      if (customer && customer.type !== "retail" && v.wholesalePrice != null && dec(v.wholesalePrice).lt(floor)) floor = dec(v.wholesalePrice)
      const quoted = order?.lines.find((ol) => ol.variationId === l.variationId)
      if (quoted && dec(quoted.unitPrice).lt(floor)) floor = dec(quoted.unitPrice)
      if (round2(l.unitPrice).lt(floor)) throw forbidden(`You are not allowed to sell ${v.product.name} — ${v.name} below ${money(num(floor))}`)
    }
  }

  // payment
  const total = dec(totals.total.toString())
  const paid = input.type === "cash" ? total : round2(input.paidAmount)
  if (input.type === "credit" && paid.gt(total)) throw validation("Paid amount cannot exceed the invoice total", "paidAmount")
  const due = total.minus(paid)

  const result = await prisma.$transaction(async (tx) => {
    // CRM-01 — read the balance under lock so concurrent sales cannot both pass the check
    let override: ReturnType<typeof checkCreditLimit> | null = null
    if (customer && input.type === "credit" && due.gt(0)) {
      const [row] = await tx.$queryRaw<{ balance: string; creditLimit: string }[]>`
        SELECT balance, creditLimit FROM customers WHERE id = ${customer.id} AND companyId = ${companyId} FOR UPDATE`
      const chk = checkCreditLimit({ balance: row.balance, creditLimit: row.creditLimit, newDue: due })
      if (chk.blocked) {
        const canOverride = can(ctx, "sales.override_credit")
        if (!input.overrideCreditLimit || !canOverride)
          throw new AppError(
            "BUSINESS_RULE",
            chk.creditLimit.lte(0)
              ? `${customer.name} has no credit limit. Take full payment or ask a manager to override.`
              : `Credit limit exceeded for ${customer.name}: outstanding ${money(chk.balance.toNumber())} + due ${money(chk.due.toNumber())} is over the limit of ${money(chk.creditLimit.toNumber())}.`,
            {
              reason: "CREDIT_LIMIT",
              balance: chk.balance.toNumber(),
              creditLimit: chk.creditLimit.toNumber(),
              due: chk.due.toNumber(),
              projected: chk.projected.toNumber(),
              available: chk.available.toNumber(),
              excess: chk.excess.toNumber(),
              canOverride,
            },
          )
        override = chk
      }
    }

    const date = new Date()
    const number = await nextNumber(tx, { companyId, key: "INV", branchId: branch.id, branchCode: branch.code, date })
    const invoice = await tx.invoice.create({
      data: {
        companyId,
        branchId: branch.id,
        number,
        type: input.type,
        status: "confirmed",
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? input.customerName,
        customerPhone: customer?.phone ?? input.customerPhone,
        salesmanId,
        salesOrderId: order?.id ?? null,
        invoiceDate: date,
        subtotal: totals.subtotal.toString(),
        discount: totals.discount.toString(),
        tax: totals.tax.toString(),
        deliveryCharge: totals.deliveryCharge.toString(),
        total: total.toString(),
        paidAmount: paid.toString(),
        dueAmount: due.toString(),
        paymentMethod: paid.gt(0) ? input.paymentMethod : null,
        note: input.note,
        creditOverrideById: override ? ctx.userId : null,
        createdById: ctx.userId,
      },
    })

    // SLS-02 — FIFO stock issue per line, snapshot batches and weighted cost (SLS-10)
    let costTotal = dec(0)
    for (const [i, l] of totals.lines.entries()) {
      const src = input.lines[i]
      const v = varMap.get(src.variationId)!
      const issued = await issueStockFIFO(tx, {
        companyId,
        branchId: branch.id,
        variationId: v.id,
        quantity: l.quantity.toString(),
        type: "sale_out",
        refType: "invoice",
        refId: invoice.id,
        note: number,
        userId: ctx.userId,
        label: `${v.product.name} — ${v.name}`,
      })
      await tx.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          variationId: v.id,
          description: src.description,
          quantity: l.quantity.toString(),
          unitPrice: l.unitPrice.toString(),
          discount: l.discount.toString(),
          lineTotal: l.lineTotal.toString(),
          unitCost: issued.unitCost,
          batches: { create: issued.allocations.map((a) => ({ batchId: a.batchId, quantity: a.quantity, unitCost: a.unitCost })) },
        },
      })
      costTotal = costTotal.plus(lineCost(l.quantity, issued.unitCost).toString())
    }
    await tx.invoice.update({ where: { id: invoice.id }, data: { costTotal } })

    // customer ledger (CRM-02, SLS-04)
    let receipt: { id: string; number: string } | null = null
    if (customer) {
      await postCustomerLedger(tx, {
        companyId,
        customerId: customer.id,
        branchId: branch.id,
        type: "invoice",
        debit: total.toString(),
        refType: "invoice",
        refId: invoice.id,
        note: `Invoice ${number}`,
        date,
        userId: ctx.userId,
      })
      if (input.type === "cash")
        await postCustomerLedger(tx, {
          companyId,
          customerId: customer.id,
          branchId: branch.id,
          type: "payment",
          credit: total.toString(),
          refType: "invoice",
          refId: invoice.id,
          note: `Paid in full on ${number}`,
          date,
          userId: ctx.userId,
        })
    }
    if (input.type === "credit" && customer && paid.gt(0)) {
      const mrNumber = await nextNumber(tx, { companyId, key: "MR", branchId: branch.id, branchCode: branch.code, date })
      receipt = await tx.moneyReceipt.create({
        data: {
          companyId,
          branchId: branch.id,
          customerId: customer.id,
          invoiceId: invoice.id,
          number: mrNumber,
          amount: paid.toString(),
          method: input.paymentMethod,
          reference: input.paymentReference,
          note: `Paid at counter against ${number}`,
          date,
          createdById: ctx.userId,
          allocations: { create: [{ invoiceId: invoice.id, amount: paid.toString() }] },
        },
        select: { id: true, number: true },
      })
      await postCustomerLedger(tx, {
        companyId,
        customerId: customer.id,
        branchId: branch.id,
        type: "payment",
        credit: paid.toString(),
        refType: "receipt",
        refId: receipt.id,
        note: `${mrNumber} against ${number}`,
        date,
        userId: ctx.userId,
      })
    }

    // SLS-03 — delivery challan
    const challanNumber = await nextNumber(tx, { companyId, key: "CH", branchId: branch.id, branchCode: branch.code, date })
    const challan = await tx.challan.create({
      data: {
        companyId,
        branchId: branch.id,
        invoiceId: invoice.id,
        number: challanNumber,
        deliveryAddress: input.deliveryAddress ?? customer?.address ?? null,
        status: "pending",
        showPrices: false,
      },
    })

    if (order) {
      const upd = await tx.salesOrder.updateMany({
        where: { id: order.id, companyId, status: "open" },
        data: { status: "converted", convertedInvoiceId: invoice.id },
      })
      if (upd.count !== 1) throw businessRule(`${order.number} was converted by someone else`)
    }

    await audit(
      ctx,
      {
        action: "create",
        entityType: "invoice",
        entityId: invoice.id,
        summary: `Created ${input.type} invoice ${number} — ${money(total.toNumber())}${customer ? ` for ${customer.name}` : ""}`,
        after: {
          number,
          type: input.type,
          branchId: branch.id,
          customerId: customer?.id ?? null,
          salesmanId,
          total: total.toString(),
          paid: paid.toString(),
          due: due.toString(),
          costTotal: costTotal.toString(),
          lines: input.lines.length,
          salesOrderId: order?.id ?? null,
          receipt: receipt?.number ?? null,
          challan: challanNumber,
        },
      },
      tx,
    )
    if (override)
      await audit(
        ctx,
        {
          action: "credit_override",
          entityType: "invoice",
          entityId: invoice.id,
          summary: `Credit limit overridden on ${number} for ${customer!.name} (over by ${money(override.excess.toNumber())})`,
          after: {
            balance: override.balance.toString(),
            creditLimit: override.creditLimit.toString(),
            due: override.due.toString(),
            projected: override.projected.toString(),
          },
        },
        tx,
      )

    return { invoice, challan, receipt, override: !!override }
  }, TX_OPTS)

  return {
    id: result.invoice.id,
    number: result.invoice.number,
    type: input.type,
    total: total.toNumber(),
    paidAmount: paid.toNumber(),
    dueAmount: due.toNumber(),
    challanId: result.challan.id,
    challanNumber: result.challan.number,
    receiptNumber: result.receipt?.number ?? null,
    creditOverride: result.override,
  }
}

// ───────── Cancel (SLS-05) ─────────

export async function cancelInvoice(ctx: TenantContext, id: string, reason: string) {
  const companyId = ctx.companyId
  const inv = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: { lines: { include: { batches: { orderBy: { id: "asc" } } } }, challans: true },
  })
  if (!inv) throw notFound("Invoice")
  assertBranch(ctx, inv.branchId)
  if (inv.status === "cancelled") throw businessRule("This invoice is already cancelled")
  if (inv.status !== "confirmed") throw businessRule("Invoices with returns cannot be cancelled — use a sales return instead")
  const returns = await prisma.salesReturn.count({ where: { companyId, invoiceId: id, status: { not: "rejected" } } })
  if (returns) throw businessRule("This invoice has a sales return and can no longer be cancelled")
  if (inv.challans.some((c) => c.status === "delivered"))
    throw businessRule("Goods have already been delivered. Mark the challan undelivered first, or use a sales return.")

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } })
  const w = cancelWindow({ createdAt: inv.createdAt, windowHours: cancelWindowHours(company?.settings), isOwner: ctx.isOwner })
  if (!w.open) throw businessRule(`Invoices can only be cancelled within ${w.hours} hours of the sale. Ask the owner, or use a sales return.`)

  // money receipts paying this invoice — they must not also pay other invoices
  const allocs = await prisma.receiptAllocation.findMany({ where: { invoiceId: id }, select: { receiptId: true } })
  const receipts = await prisma.moneyReceipt.findMany({
    where: { companyId, cancelledAt: null, OR: [{ invoiceId: id }, { id: { in: allocs.map((a) => a.receiptId) } }] },
    include: { allocations: true },
  })
  const shared = receipts.find((r) => r.allocations.some((a) => a.invoiceId !== id))
  if (shared) throw businessRule(`Money receipt ${shared.number} also pays other invoices. Reverse that receipt first.`)

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const upd = await tx.invoice.updateMany({
      where: { id, companyId, status: "confirmed" },
      data: { status: "cancelled", cancelledAt: now, cancelledById: ctx.userId, cancelReason: reason },
    })
    if (upd.count !== 1) throw businessRule("This invoice was changed by someone else. Reload and try again.")

    for (const line of inv.lines) {
      const qty = dec(line.quantity).minus(dec(line.returnedQty))
      if (qty.lte(0) || !line.batches.length) continue
      await restoreToBatches(tx, {
        companyId,
        branchId: inv.branchId,
        variationId: line.variationId,
        allocations: line.batches,
        quantity: qty,
        type: "cancel_in",
        refType: "invoice_cancel",
        refId: id,
        note: `Cancelled ${inv.number}`,
        userId: ctx.userId,
      })
    }

    if (inv.customerId) {
      await postCustomerLedger(tx, {
        companyId,
        customerId: inv.customerId,
        branchId: inv.branchId,
        type: "adjustment",
        credit: inv.total,
        refType: "invoice_cancel",
        refId: id,
        note: `Cancelled ${inv.number}`,
        date: now,
        userId: ctx.userId,
      })
      if (dec(inv.paidAmount).gt(0))
        await postCustomerLedger(tx, {
          companyId,
          customerId: inv.customerId,
          branchId: inv.branchId,
          type: "refund",
          debit: inv.paidAmount,
          refType: "invoice_cancel",
          refId: id,
          note: `Refund on cancelled ${inv.number}`,
          date: now,
          userId: ctx.userId,
        })
    }
    if (receipts.length)
      await tx.moneyReceipt.updateMany({ where: { companyId, id: { in: receipts.map((r) => r.id) } }, data: { cancelledAt: now } })

    await audit(
      ctx,
      {
        action: "cancel",
        entityType: "invoice",
        entityId: id,
        summary: `Cancelled invoice ${inv.number} — ${reason}`.slice(0, 255),
        before: { status: inv.status, total: inv.total.toString(), paidAmount: inv.paidAmount.toString() },
        after: { status: "cancelled", reason, receiptsCancelled: receipts.map((r) => r.number), ownerBypass: w.bypass },
      },
      tx,
    )
  }, TX_OPTS)
  return { id, number: inv.number, status: "cancelled" as const }
}

// ───────── Print status (SLS-08, DLV-02) ─────────

export async function recordPrint(ctx: TenantContext, docType: "invoice" | "challan", id: string) {
  const companyId = ctx.companyId
  return prisma.$transaction(async (tx) => {
    const doc =
      docType === "invoice"
        ? await tx.invoice.findFirst({ where: { id, companyId, ...invoiceScope(ctx) }, select: { id: true, branchId: true, number: true } })
        : await tx.challan.findFirst({ where: { id, companyId }, select: { id: true, branchId: true, number: true } })
    if (!doc) throw notFound(docType === "invoice" ? "Invoice" : "Challan")
    assertBranch(ctx, doc.branchId)
    const data = { printCount: { increment: 1 }, lastPrintedAt: new Date() }
    const updated =
      docType === "invoice"
        ? await tx.invoice.update({ where: { id }, data, select: { printCount: true } })
        : await tx.challan.update({ where: { id }, data, select: { printCount: true } })
    await tx.printLog.create({ data: { companyId, docType, docId: id, userId: ctx.userId } })
    if (updated.printCount > 1)
      await audit(
        ctx,
        { action: "reprint", entityType: docType, entityId: id, summary: `Reprinted ${docType} ${doc.number} (print #${updated.printCount})` },
        tx,
      )
    return { printCount: updated.printCount }
  })
}

// ───────── Challans (DLV-02) ─────────

export async function updateChallan(ctx: TenantContext, id: string, input: ChallanUpdateOutput) {
  const companyId = ctx.companyId
  const before = await prisma.challan.findFirst({ where: { id, companyId }, include: { invoice: { select: { status: true, number: true } } } })
  if (!before) throw notFound("Challan")
  assertBranch(ctx, before.branchId)
  if (before.invoice.status === "cancelled" && input.status === "delivered")
    throw businessRule(`Invoice ${before.invoice.number} is cancelled — its challan cannot be delivered`)
  const delivered = input.status === "delivered"
  const deliveryDate = input.deliveryDate ? new Date(`${input.deliveryDate}T00:00:00`) : null
  const challan = await prisma.$transaction(async (tx) => {
    const row = await tx.challan.update({
      where: { id },
      data: {
        deliveryAddress: input.deliveryAddress,
        deliveryPerson: input.deliveryPerson,
        deliveryPhone: input.deliveryPhone,
        vehicleNo: input.vehicleNo,
        deliveryDate: deliveryDate ?? (delivered ? (before.deliveryDate ?? new Date()) : null),
        note: input.note,
        showPrices: input.showPrices,
        status: input.status,
        deliveredAt: delivered ? (before.deliveredAt ?? new Date()) : null,
      },
    })
    const statusChanged = before.status !== row.status
    await audit(
      ctx,
      {
        action: statusChanged ? (delivered ? "deliver" : "undeliver") : "update",
        entityType: "challan",
        entityId: id,
        summary: statusChanged
          ? `Marked challan ${row.number} ${delivered ? "delivered" : "undelivered"}`
          : `Updated delivery info on challan ${row.number}`,
        before: { ...before, invoice: undefined },
        after: row,
      },
      tx,
    )
    return row
  })
  return { id: challan.id, number: challan.number, status: challan.status }
}

// ───────── Salesmen (SLS-09) ─────────

export async function listSalesmen(ctx: TenantContext, branchId?: string | null) {
  const rows = await prisma.user.findMany({
    where: {
      companyId: ctx.companyId,
      status: "active",
      ...(branchId ? { OR: [{ allBranches: true }, { isOwner: true }, { branches: { some: { branchId } } }] } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, designation: true, employeeCode: true },
  })
  return rows
}
