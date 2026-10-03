import "server-only"
import { audit } from "@/server/audit"
import { assertBranch, type TenantContext } from "@/server/auth/context"
import type { TenantDb } from "@/server/db"
import { dec, num, round2, sum, type Dec } from "@/server/decimal"
import { AppError, businessRule, notFound } from "@/server/errors"
import { restoreToBatches } from "@/server/modules/inventory/stock"
import { postCustomerLedger } from "@/server/modules/ledger/service"
import { nextNumber } from "@/server/modules/common/sequence"
import type { RejectOutput, ReturnOutput } from "@/lib/validation/sales-after"
import { allowedRefundModes, chargeFactor, restockableBatches, returnLineAmount, returnableQty, splitCreditNote, statusAfterReturn } from "./calc"
import { docDateTime, lockCustomer, lockInvoices, pd, run, type Tx } from "./shared"

const RETURNABLE_STATUSES = ["confirmed", "partially_returned"] as const

type Db = Tx | TenantDb

/** Per invoice line: qty held by pending requests, and qty/amount of approved returns (+ restocked qty). */
async function returnHistory(db: Db, companyId: string, invoiceId: string, excludeReturnId?: string) {
  const lines = await db.salesReturnLine.findMany({
    where: { salesReturn: { companyId, invoiceId, status: { in: ["pending", "approved"] }, ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}) } },
    include: { salesReturn: { select: { status: true, restock: true } } },
  })
  const pending = new Map<string, Dec>()
  const approvedAmount = new Map<string, Dec>()
  const restocked = new Map<string, Dec>()
  const add = (m: Map<string, Dec>, k: string, v: Dec) => m.set(k, (m.get(k) ?? dec(0)).plus(v))
  for (const l of lines) {
    if (l.salesReturn.status === "pending") add(pending, l.invoiceLineId, dec(l.quantity))
    else {
      add(approvedAmount, l.invoiceLineId, dec(l.amount))
      if (l.salesReturn.restock) add(restocked, l.invoiceLineId, dec(l.quantity))
    }
  }
  return { pending, approvedAmount, restocked }
}

async function variationNames(db: Db, companyId: string, ids: string[]) {
  const rows = await db.productVariation.findMany({
    where: { companyId, id: { in: [...new Set(ids)] } },
    select: { id: true, name: true, sku: true, product: { select: { name: true, unit: true } } },
  })
  return new Map(rows.map((v) => [v.id, { productName: v.product.name, name: v.name, sku: v.sku, unit: v.product.unit }]))
}

const factorOf = (inv: { total: Dec; deliveryCharge: Dec; lines: { lineTotal: Dec }[] }) =>
  chargeFactor({ lineTotals: inv.lines.map((l) => l.lineTotal), total: inv.total, deliveryCharge: inv.deliveryCharge })

// ───────── Queries for the return form ─────────

export async function searchReturnableInvoices(ctx: TenantContext, db: TenantDb, q: string) {
  const term = q.trim()
  const rows = await db.invoice.findMany({
    where: {
      branchId: { in: ctx.branchIds },
      status: { in: [...RETURNABLE_STATUSES] },
      ...(term ? { OR: [{ number: { contains: term } }, { customerName: { contains: term } }, { customerPhone: { contains: term } }] } : {}),
    },
    orderBy: { invoiceDate: "desc" },
    take: 20,
    select: { id: true, number: true, invoiceDate: true, customerName: true, customerId: true, total: true, type: true, status: true },
  })
  const customers = await db.customer.findMany({
    where: { id: { in: rows.map((r) => r.customerId).filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  })
  const cname = new Map(customers.map((c) => [c.id, c.name]))
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.invoiceDate.toISOString(),
    customerName: (r.customerId && cname.get(r.customerId)) || r.customerName || "Walk-in customer",
    total: num(r.total),
    type: r.type,
    status: r.status,
  }))
}

/** Invoice with what each line can still return (sold − returned − pending), allowed refund modes. */
export async function returnableInvoice(ctx: TenantContext, db: TenantDb, id: string) {
  const inv = await db.invoice.findFirst({ where: { id }, include: { lines: true } })
  if (!inv) throw notFound("Invoice")
  assertBranch(ctx, inv.branchId)
  const [hist, names, customer, branch] = await Promise.all([
    returnHistory(db, ctx.companyId, inv.id),
    variationNames(db, ctx.companyId, inv.lines.map((l) => l.variationId)),
    inv.customerId ? db.customer.findFirst({ where: { id: inv.customerId }, select: { id: true, name: true, phone: true } }) : null,
    db.branch.findFirst({ where: { id: inv.branchId }, select: { name: true } }),
  ])
  const factor = factorOf(inv)
  return {
    id: inv.id,
    number: inv.number,
    type: inv.type,
    status: inv.status,
    date: inv.invoiceDate.toISOString(),
    branchName: branch?.name ?? "—",
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    customerName: customer?.name ?? inv.customerName ?? "Walk-in customer",
    total: num(inv.total),
    paidAmount: num(inv.paidAmount),
    dueAmount: num(inv.dueAmount),
    returnedAmount: num(inv.returnedAmount),
    factor: factor.toNumber(),
    returnable: (RETURNABLE_STATUSES as readonly string[]).includes(inv.status),
    refundModes: allowedRefundModes({ type: inv.type, customerId: inv.customerId, dueAmount: inv.dueAmount }),
    lines: inv.lines.map((l) => {
      const n = names.get(l.variationId)
      const pendingQty = hist.pending.get(l.id) ?? dec(0)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: n?.productName ?? l.description ?? "Item",
        variationName: n?.name ?? "",
        sku: n?.sku ?? "",
        unit: n?.unit ?? "pcs",
        quantity: num(l.quantity),
        returnedQty: num(l.returnedQty),
        pendingQty: num(pendingQty),
        returnable: num(returnableQty({ quantity: l.quantity, returnedQty: l.returnedQty, pendingQty })),
        unitPrice: num(l.unitPrice),
        discount: num(l.discount),
        lineTotal: num(l.lineTotal),
      }
    }),
  }
}
export type ReturnableInvoice = Awaited<ReturnType<typeof returnableInvoice>>

// ───────── Request (pending) ─────────

export async function createReturn(ctx: TenantContext, input: ReturnOutput) {
  if (new Set(input.lines.map((l) => l.invoiceLineId)).size !== input.lines.length) throw businessRule("An item is listed twice")
  return run(async (tx) => {
    const [locked] = await lockInvoices(tx, ctx.companyId, [input.invoiceId])
    if (!locked) throw notFound("Invoice")
    assertBranch(ctx, locked.branchId)
    if (!(RETURNABLE_STATUSES as readonly string[]).includes(locked.status))
      throw businessRule(locked.status === "returned" ? "Everything on this invoice has already been returned" : `A ${locked.status} invoice cannot be returned`)
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: locked.id }, include: { lines: true } })
    const modes = allowedRefundModes({ type: inv.type, customerId: inv.customerId, dueAmount: inv.dueAmount })
    if (!modes.includes(input.refundMode))
      throw new AppError(
        "VALIDATION_ERROR",
        !inv.customerId ? "Walk-in sales can only be refunded in cash" : "This credit invoice still has dues — refund it with a credit note",
        { fields: { refundMode: "Not allowed for this invoice" } },
      )

    const hist = await returnHistory(tx, ctx.companyId, inv.id)
    const factor = factorOf(inv)
    const lines = input.lines.map((l, i) => {
      const line = inv.lines.find((x) => x.id === l.invoiceLineId)
      if (!line) throw new AppError("VALIDATION_ERROR", "Item is not on this invoice", { fields: { [`lines.${i}.quantity`]: "Not on this invoice" } })
      const qty = dec(l.quantity)
      const can = returnableQty({ quantity: line.quantity, returnedQty: line.returnedQty, pendingQty: hist.pending.get(line.id) })
      if (qty.gt(can.toString()))
        throw new AppError("VALIDATION_ERROR", `Only ${can.toString()} can be returned for one of the items`, {
          fields: { [`lines.${i}.quantity`]: `Max ${can.toString()}` },
        })
      const amount = returnLineAmount({
        lineQty: line.quantity,
        unitPrice: line.unitPrice,
        lineDiscount: line.discount,
        lineTotal: line.lineTotal,
        returnQty: qty,
        alreadyReturnedQty: line.returnedQty,
        alreadyReturnedAmount: hist.approvedAmount.get(line.id),
        factor,
      })
      return { line, qty, amount: pd(amount), cost: round2(qty.times(line.unitCost)) }
    })

    const branch = await tx.branch.findUniqueOrThrow({ where: { id: inv.branchId } })
    const date = docDateTime(input.date)
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "SR", branchId: branch.id, branchCode: branch.code, date })
    const ret = await tx.salesReturn.create({
      data: {
        companyId: ctx.companyId,
        branchId: inv.branchId,
        invoiceId: inv.id,
        customerId: inv.customerId,
        number,
        status: "pending",
        refundMode: input.refundMode,
        restock: input.restock,
        reason: input.reason,
        totalAmount: sum(lines.map((l) => l.amount)),
        costAmount: sum(lines.map((l) => l.cost)),
        date,
        requestedById: ctx.userId,
        lines: {
          create: lines.map((l) => ({
            invoiceLineId: l.line.id,
            variationId: l.line.variationId,
            quantity: l.qty,
            unitPrice: l.line.unitPrice,
            amount: l.amount,
            unitCost: l.line.unitCost,
          })),
        },
      },
    })
    await audit(
      ctx,
      {
        action: "create",
        entityType: "sales_return",
        entityId: ret.id,
        summary: `Return ${number} requested on ${inv.number} (${dec(ret.totalAmount).toFixed(2)}, ${input.refundMode.replace("_", " ")})`,
        after: ret,
      },
      tx,
    )
    return { id: ret.id, number, totalAmount: num(ret.totalAmount) }
  })
}

// ───────── Approve / reject ─────────

/**
 * Approve a pending return (one transaction): restock into the original batches, update the invoice,
 * then a credit note (reduces the invoice due first) or a cash refund (ledger return + refund, net zero).
 */
export async function approveReturn(ctx: TenantContext, id: string) {
  return run(async (tx) => {
    const head = await tx.salesReturn.findFirst({ where: { id, companyId: ctx.companyId } })
    if (!head) throw notFound("Return")
    assertBranch(ctx, head.branchId)
    if (head.customerId) await lockCustomer(tx, ctx.companyId, head.customerId)
    const [locked] = await lockInvoices(tx, ctx.companyId, [head.invoiceId])
    if (!locked) throw notFound("Invoice")
    const ret = await tx.salesReturn.findUniqueOrThrow({ where: { id }, include: { lines: true } })
    if (ret.status !== "pending") throw businessRule(`This return is already ${ret.status}`)
    if (!(RETURNABLE_STATUSES as readonly string[]).includes(locked.status))
      throw businessRule(`Invoice ${locked.number} is ${locked.status.replace("_", " ")} and cannot take this return`)
    if (ret.refundMode === "credit_note" && !ret.customerId) throw businessRule("A credit note needs a customer")

    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: locked.id }, include: { lines: { include: { batches: true } } } })
    const hist = await returnHistory(tx, ctx.companyId, inv.id, ret.id)
    const factor = factorOf(inv)
    const batchIds = inv.lines.flatMap((l) => l.batches.map((b) => b.batchId))
    const batchInfo = new Map(
      (await tx.inventoryBatch.findMany({ where: { id: { in: batchIds } }, select: { id: true, receivedAt: true, createdAt: true } })).map((b) => [b.id, b]),
    )
    const fifo = (a: { batchId: string }, b: { batchId: string }) => {
      const x = batchInfo.get(a.batchId)
      const y = batchInfo.get(b.batchId)
      return (x?.receivedAt.getTime() ?? 0) - (y?.receivedAt.getTime() ?? 0) || (x?.createdAt.getTime() ?? 0) - (y?.createdAt.getTime() ?? 0)
    }

    const returned = new Map(inv.lines.map((l) => [l.id, dec(l.returnedQty)]))
    let total = dec(0)
    let cost = dec(0)
    for (const rl of ret.lines) {
      const line = inv.lines.find((l) => l.id === rl.invoiceLineId)
      if (!line) throw businessRule("A returned item is no longer on the invoice")
      const remaining = dec(line.quantity).minus(line.returnedQty)
      if (dec(rl.quantity).gt(remaining)) throw businessRule(`Only ${remaining.toString()} of an item can still be returned`)
      const amount = pd(
        returnLineAmount({
          lineQty: line.quantity,
          unitPrice: line.unitPrice,
          lineDiscount: line.discount,
          lineTotal: line.lineTotal,
          returnQty: rl.quantity,
          alreadyReturnedQty: line.returnedQty,
          alreadyReturnedAmount: hist.approvedAmount.get(line.id),
          factor,
        }),
      )
      const lineCost = round2(dec(rl.quantity).times(line.unitCost))
      total = total.plus(amount)
      cost = cost.plus(lineCost)
      await tx.salesReturnLine.update({ where: { id: rl.id }, data: { amount, unitPrice: line.unitPrice, unitCost: line.unitCost } })

      if (ret.restock) {
        const allocations = restockableBatches(
          [...line.batches].sort(fifo).map((b) => ({ batchId: b.batchId, quantity: b.quantity, unitCost: b.unitCost })),
          hist.restocked.get(line.id),
        ).map((a) => ({ batchId: a.batchId, quantity: a.quantity.toString(), unitCost: a.unitCost }))
        await restoreToBatches(tx, {
          companyId: ctx.companyId,
          branchId: inv.branchId,
          variationId: line.variationId,
          allocations,
          quantity: rl.quantity,
          type: "return_in",
          refType: "return",
          refId: ret.id,
          note: `Return ${ret.number} on ${inv.number}`,
          userId: ctx.userId,
        })
      }
      await tx.invoiceLine.update({ where: { id: line.id }, data: { returnedQty: { increment: rl.quantity } } })
      returned.set(line.id, (returned.get(line.id) ?? dec(0)).plus(rl.quantity))
    }

    const status = statusAfterReturn(inv.lines.map((l) => ({ quantity: l.quantity, returnedQty: returned.get(l.id) })))
    const now = new Date()
    let creditNote: { id: string; number: string } | null = null
    let dueReduction = dec(0)

    if (ret.refundMode === "credit_note") {
      const split = splitCreditNote(total.toString(), inv.dueAmount)
      dueReduction = pd(split.dueReduction)
      const branch = await tx.branch.findUniqueOrThrow({ where: { id: inv.branchId } })
      const number = await nextNumber(tx, { companyId: ctx.companyId, key: "CN", branchId: branch.id, branchCode: branch.code, date: now })
      const cn = await tx.creditNote.create({
        data: {
          companyId: ctx.companyId,
          branchId: inv.branchId,
          customerId: ret.customerId!,
          invoiceId: inv.id,
          returnId: ret.id,
          number,
          amount: total,
          reason: `Return ${ret.number}${ret.reason ? `: ${ret.reason}` : ""}`.slice(0, 255),
          date: now,
          createdById: ctx.userId,
        },
      })
      creditNote = { id: cn.id, number }
      await postCustomerLedger(tx, {
        companyId: ctx.companyId,
        customerId: ret.customerId!,
        branchId: inv.branchId,
        type: "credit_note",
        credit: total,
        refType: "credit_note",
        refId: cn.id,
        note: `Credit note ${number} for return ${ret.number} on ${inv.number}`,
        date: now,
        userId: ctx.userId,
      })
    } else if (ret.customerId) {
      const base = { companyId: ctx.companyId, customerId: ret.customerId, branchId: inv.branchId, refType: "return", refId: ret.id, date: now, userId: ctx.userId }
      await postCustomerLedger(tx, { ...base, type: "return", credit: total, note: `Return ${ret.number} on ${inv.number}` })
      await postCustomerLedger(tx, { ...base, type: "refund", debit: total, note: `Cash refund for return ${ret.number}` })
    }

    await tx.invoice.update({
      where: { id: inv.id },
      data: { returnedAmount: { increment: total }, status, ...(dueReduction.gt(0) ? { dueAmount: { decrement: dueReduction } } : {}) },
    })
    const updated = await tx.salesReturn.update({
      where: { id },
      data: { status: "approved", approvedById: ctx.userId, approvedAt: now, totalAmount: total, costAmount: cost },
    })
    await audit(
      ctx,
      {
        action: "approve",
        entityType: "sales_return",
        entityId: id,
        summary: `Approved return ${ret.number} on ${inv.number}: ${total.toFixed(2)} ${
          creditNote ? `as credit note ${creditNote.number}` : "refunded in cash"
        }${ret.restock ? ", restocked" : ""}`,
        before: ret,
        after: { ...updated, creditNote, dueReduction: dueReduction.toFixed(2), invoiceStatus: status },
      },
      tx,
    )
    return { id, number: ret.number, totalAmount: num(total), creditNote, dueReduction: num(dueReduction), invoiceStatus: status }
  })
}

export async function rejectReturn(ctx: TenantContext, id: string, input: RejectOutput) {
  return run(async (tx) => {
    const ret = await tx.salesReturn.findFirst({ where: { id, companyId: ctx.companyId } })
    if (!ret) throw notFound("Return")
    assertBranch(ctx, ret.branchId)
    await tx.$queryRaw`SELECT id FROM sales_returns WHERE id = ${id} FOR UPDATE`
    const fresh = await tx.salesReturn.findUniqueOrThrow({ where: { id } })
    if (fresh.status !== "pending") throw businessRule(`This return is already ${fresh.status}`)
    const updated = await tx.salesReturn.update({ where: { id }, data: { status: "rejected", rejectNote: input.note, approvedById: ctx.userId } })
    await audit(ctx, { action: "reject", entityType: "sales_return", entityId: id, summary: `Rejected return ${ret.number}: ${input.note}`, before: fresh, after: updated }, tx)
    return { id, number: ret.number }
  })
}

export async function recordReturnPrint(ctx: TenantContext, db: TenantDb, id: string) {
  const r = await db.salesReturn.findFirst({ where: { id }, select: { id: true, branchId: true } })
  if (!r) throw notFound("Return")
  assertBranch(ctx, r.branchId)
  await db.printLog.create({ data: { companyId: ctx.companyId, docType: "return", docId: id, userId: ctx.userId } })
  return { printed: true }
}
