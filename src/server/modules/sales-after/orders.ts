import "server-only"
import { audit } from "@/server/audit"
import { assertBranch, type TenantContext } from "@/server/auth/context"
import type { TenantDb } from "@/server/db"
import { dec, num } from "@/server/decimal"
import { AppError, businessRule, notFound } from "@/server/errors"
import { nextNumber } from "@/server/modules/common/sequence"
import type { AdvanceOutput, CancelOutput, SalesOrderOutput } from "@/lib/validation/sales-after"
import { orderTotals } from "./calc"
import { createAdvanceReceiptTx } from "./receipts"
import { ADVANCE_NOTE_PREFIX, branchFor, dbDate, lockCustomer, pd, run, type Tx } from "./shared"

async function checkParties(tx: Tx, ctx: TenantContext, input: SalesOrderOutput) {
  if (input.customerId) {
    const c = await tx.customer.findFirst({ where: { id: input.customerId, companyId: ctx.companyId }, select: { status: true } })
    if (!c) throw new AppError("VALIDATION_ERROR", "Choose a valid customer", { fields: { customerId: "Unknown customer" } })
    if (c.status !== "active") throw new AppError("VALIDATION_ERROR", "This customer is inactive", { fields: { customerId: "Inactive customer" } })
  }
  const ids = [...new Set(input.lines.map((l) => l.variationId))]
  const found = await tx.productVariation.count({ where: { companyId: ctx.companyId, id: { in: ids } } })
  if (found !== ids.length) throw businessRule("One of the products no longer exists")
}

function lineRows(input: SalesOrderOutput) {
  const t = orderTotals(input.lines, input.discount)
  return {
    subtotal: pd(t.subtotal),
    total: pd(t.total),
    discount: dec(input.discount).toDecimalPlaces(2),
    lines: input.lines.map((l, i) => ({
      variationId: l.variationId,
      quantity: dec(l.quantity),
      unitPrice: dec(l.unitPrice).toDecimalPlaces(2),
      discount: dec(l.discount).toDecimalPlaces(2),
      lineTotal: pd(t.lineTotals[i]),
    })),
  }
}

/** Create a quotation (QT) or sales order (SO); an order may take an advance (customer ledger credit). */
export async function createOrder(ctx: TenantContext, input: SalesOrderOutput) {
  return run(async (tx) => {
    const branch = await branchFor(tx, ctx, input.branchId)
    await checkParties(tx, ctx, input)
    const rows = lineRows(input)
    const date = dbDate(input.date)
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: input.type === "quotation" ? "QT" : "SO", branchId: branch.id, branchCode: branch.code, date })
    const order = await tx.salesOrder.create({
      data: {
        companyId: ctx.companyId,
        branchId: branch.id,
        customerId: input.customerId,
        salesmanId: ctx.userId,
        number,
        type: input.type,
        status: "open",
        date,
        validUntil: input.validUntil ? dbDate(input.validUntil) : null,
        subtotal: rows.subtotal,
        discount: rows.discount,
        total: rows.total,
        note: input.note,
        createdById: ctx.userId,
        lines: { create: rows.lines },
      },
    })
    let advance = null
    if (input.advance && input.type === "order" && input.customerId) {
      await lockCustomer(tx, ctx.companyId, input.customerId)
      advance = await createAdvanceReceiptTx(tx, ctx, { customerId: input.customerId, branch, advance: input.advance, note: `${ADVANCE_NOTE_PREFIX}${number}`, salesOrderId: order.id })
      await tx.salesOrder.update({ where: { id: order.id }, data: { advanceAmount: advance.amount } })
    }
    await audit(
      ctx,
      { action: "create", entityType: "sales_order", entityId: order.id, summary: `Created ${input.type} ${number} (${dec(order.total).toFixed(2)})`, after: { ...order, lines: rows.lines } },
      tx,
    )
    return { id: order.id, number, advanceReceipt: advance ? { id: advance.id, number: advance.number } : null }
  })
}

async function lockOrder(tx: Tx, ctx: TenantContext, id: string) {
  const head = await tx.salesOrder.findFirst({ where: { id, companyId: ctx.companyId }, select: { id: true, branchId: true } })
  if (!head) throw notFound("Order")
  assertBranch(ctx, head.branchId)
  await tx.$queryRaw`SELECT id FROM sales_orders WHERE id = ${id} FOR UPDATE`
  return tx.salesOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } })
}

export async function updateOrder(ctx: TenantContext, id: string, input: SalesOrderOutput) {
  return run(async (tx) => {
    const before = await lockOrder(tx, ctx, id)
    if (before.status !== "open") throw businessRule(`A ${before.status} ${before.type} cannot be edited`)
    if (input.type !== before.type) throw businessRule(`The document type cannot be changed — create a new ${input.type}`)
    if (input.branchId !== before.branchId) throw businessRule("The branch cannot be changed after creation")
    if (dec(before.advanceAmount).gt(0) && input.customerId !== before.customerId)
      throw new AppError("VALIDATION_ERROR", "An advance was taken from this customer — the customer cannot be changed", {
        fields: { customerId: "Advance already taken" },
      })
    await checkParties(tx, ctx, input)
    const rows = lineRows(input)
    await tx.salesOrderLine.deleteMany({ where: { orderId: id } })
    const order = await tx.salesOrder.update({
      where: { id },
      data: {
        customerId: input.customerId,
        date: dbDate(input.date),
        validUntil: input.validUntil ? dbDate(input.validUntil) : null,
        subtotal: rows.subtotal,
        discount: rows.discount,
        total: rows.total,
        note: input.note,
        lines: { create: rows.lines },
      },
    })
    await audit(ctx, { action: "update", entityType: "sales_order", entityId: id, summary: `Edited ${order.type} ${order.number}`, before, after: { ...order, lines: rows.lines } }, tx)
    return { id, number: order.number }
  })
}

/** Take (another) advance on an open order. */
export async function addOrderAdvance(ctx: TenantContext, id: string, input: AdvanceOutput) {
  return run(async (tx) => {
    const order = await lockOrder(tx, ctx, id)
    if (order.type !== "order") throw businessRule("Advances are taken on sales orders, not quotations")
    if (order.status !== "open") throw businessRule(`This order is ${order.status}`)
    if (!order.customerId) throw businessRule("This order has no customer")
    await lockCustomer(tx, ctx.companyId, order.customerId)
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: order.branchId } })
    const receipt = await createAdvanceReceiptTx(tx, ctx, { customerId: order.customerId, branch, advance: input, note: `${ADVANCE_NOTE_PREFIX}${order.number}`, salesOrderId: order.id })
    const updated = await tx.salesOrder.update({ where: { id }, data: { advanceAmount: { increment: receipt.amount } } })
    await audit(ctx, { action: "update", entityType: "sales_order", entityId: id, summary: `Advance ${receipt.number} of ${dec(receipt.amount).toFixed(2)} on ${order.number}` }, tx)
    return { id, receipt: { id: receipt.id, number: receipt.number }, advanceAmount: num(updated.advanceAmount) }
  })
}

/** SLS-07: cancel a quotation/order before it becomes an invoice. Any advance stays with the customer. */
export async function cancelOrder(ctx: TenantContext, id: string, input: CancelOutput) {
  return run(async (tx) => {
    const order = await lockOrder(tx, ctx, id)
    if (order.status !== "open") throw businessRule(`This ${order.type} is already ${order.status}`)
    const updated = await tx.salesOrder.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date(), cancelReason: input.reason } })
    const kept = dec(order.advanceAmount)
    await audit(
      ctx,
      {
        action: "cancel",
        entityType: "sales_order",
        entityId: id,
        summary: `Cancelled ${order.type} ${order.number}: ${input.reason}${kept.gt(0) ? ` (advance ${kept.toFixed(2)} kept as customer advance)` : ""}`,
        before: order,
        after: updated,
      },
      tx,
    )
    return { id, number: order.number, advanceKept: num(kept) }
  })
}

/** Full order for the detail page / POS conversion (C1 reads lines to prefill the cart). */
export async function getOrder(ctx: TenantContext, db: TenantDb, id: string) {
  const o = await db.salesOrder.findFirst({ where: { id }, include: { lines: true } })
  if (!o) throw notFound("Order")
  assertBranch(ctx, o.branchId)
  const [variations, customer, branch, creator, invoice] = await Promise.all([
    db.productVariation.findMany({
      where: { id: { in: o.lines.map((l) => l.variationId) } },
      include: { product: { select: { name: true, unit: true } }, balances: { where: { branchId: o.branchId } } },
    }),
    o.customerId ? db.customer.findFirst({ where: { id: o.customerId } }) : null,
    db.branch.findFirst({ where: { id: o.branchId }, select: { id: true, name: true, code: true } }),
    o.createdById ? db.user.findFirst({ where: { id: o.createdById }, select: { name: true } }) : null,
    o.convertedInvoiceId ? db.invoice.findFirst({ where: { id: o.convertedInvoiceId }, select: { id: true, number: true } }) : null,
  ])
  const vmap = new Map(variations.map((v) => [v.id, v]))
  return {
    id: o.id,
    number: o.number,
    type: o.type,
    status: o.status,
    date: o.date.toISOString().slice(0, 10),
    validUntil: o.validUntil ? o.validUntil.toISOString().slice(0, 10) : null,
    branch,
    customer: customer
      ? {
          id: customer.id,
          code: customer.code,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          type: customer.type,
          creditLimit: num(customer.creditLimit),
          balance: num(customer.balance),
        }
      : null,
    subtotal: num(o.subtotal),
    discount: num(o.discount),
    total: num(o.total),
    advanceAmount: num(o.advanceAmount),
    note: o.note,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    cancelReason: o.cancelReason,
    createdBy: creator?.name ?? null,
    createdAt: o.createdAt.toISOString(),
    convertedInvoice: invoice,
    lines: o.lines.map((l) => {
      const v = vmap.get(l.variationId)
      return {
        id: l.id,
        variationId: l.variationId,
        productId: v?.productId ?? "",
        productName: v?.product.name ?? "Deleted product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        barcode: v?.barcode ?? null,
        unit: v?.product.unit ?? "pcs",
        unitWeight: num(v?.unitWeight),
        salePrice: num(v?.salePrice),
        wholesalePrice: v?.wholesalePrice == null ? null : num(v.wholesalePrice),
        stock: num(v?.balances[0]?.quantity),
        quantity: num(l.quantity),
        unitPrice: num(l.unitPrice),
        discount: num(l.discount),
        lineTotal: num(l.lineTotal),
      }
    }),
  }
}
export type OrderDetail = Awaited<ReturnType<typeof getOrder>>
