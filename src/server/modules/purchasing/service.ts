import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { audit } from "@/server/audit"
import { assertBranch, assertFeature, can, type TenantContext } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { dec, num, round2, round4, sum } from "@/server/decimal"
import { businessRule, notFound } from "@/server/errors"
import { nextNumber } from "@/server/modules/common/sequence"
import { receiveStock } from "@/server/modules/inventory/stock"
import { postSupplierLedger } from "@/server/modules/ledger/service"
import { assertVariations, branchMap, isoDate, movementTime, scopedBranch, toDateOnly, variationInfo } from "@/server/modules/inventory-ops/shared"
import type { GoodsReceiptOutput, PurchaseOrderOutput } from "@/lib/validation/purchasing"
import { canEditPo, cancelRemainder, lineRemaining, poStatusFor, receiptQtyProblem, toBdt, type PoStatus } from "./calc"

type Tx = Prisma.TransactionClient
const TX_OPTS = { timeout: 30_000 }

// ───────────────────────────── Purchase orders ─────────────────────────────

async function validatePoRefs(ctx: TenantContext, input: PurchaseOrderOutput) {
  const supplier = await prisma.supplier.findFirst({ where: { id: input.supplierId, companyId: ctx.companyId }, select: { id: true, name: true } })
  if (!supplier) throw notFound("Supplier")
  await assertVariations(prisma, ctx.companyId, input.lines.map((l) => l.variationId))
  return supplier
}

function priceLines(input: PurchaseOrderOutput) {
  const rate = input.currency === "BDT" ? dec(1) : dec(input.exchangeRate)
  const lines = input.lines.map((l) => ({
    variationId: l.variationId,
    quantity: dec(l.quantity),
    unitPriceForeign: input.currency === "BDT" ? null : round4(l.unitPrice),
    unitPriceBdt: dec(toBdt(l.unitPrice, input.currency, rate).toString()),
  }))
  const totalForeign = input.currency === "BDT" ? dec(0) : round4(sum(lines.map((l) => l.quantity.times(l.unitPriceForeign!))))
  const totalBdt = round2(sum(lines.map((l) => l.quantity.times(l.unitPriceBdt))))
  return { rate, lines, totalForeign, totalBdt }
}

export async function createPurchaseOrder(ctx: TenantContext, input: PurchaseOrderOutput) {
  assertBranch(ctx, input.branchId)
  const branch = scopedBranch(ctx, input.branchId)
  const supplier = await validatePoRefs(ctx, input)
  const p = priceLines(input)
  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "PO", branchId: branch.id, branchCode: branch.code, date: toDateOnly(input.orderDate) })
    const po = await tx.purchaseOrder.create({
      data: {
        companyId: ctx.companyId,
        branchId: branch.id,
        supplierId: supplier.id,
        invoiceReference: input.invoiceReference,
        bankDetails: input.bankDetails,
        number,
        orderDate: toDateOnly(input.orderDate),
        expectedDate: input.expectedDate ? toDateOnly(input.expectedDate) : null,
        currency: input.currency,
        exchangeRate: p.rate,
        totalForeign: p.totalForeign,
        totalBdt: p.totalBdt,
        notes: input.notes,
        createdById: ctx.userId,
        lines: { create: p.lines },
      },
    })
    await audit(
      ctx,
      {
        action: "create",
        entityType: "purchase_order",
        entityId: po.id,
        summary: `Created purchase order ${number} — ${supplier.name}, ৳${p.totalBdt.toFixed(2)}`,
        after: { number, supplierId: supplier.id, branchId: branch.id, currency: input.currency, totalBdt: p.totalBdt.toString(), lines: input.lines },
      },
      tx,
    )
    return { id: po.id, number }
  }, TX_OPTS)
}

async function lockPo(tx: Tx, companyId: string, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM purchase_orders WHERE id = ${id} AND companyId = ${companyId} FOR UPDATE`
  if (!row) throw notFound("Purchase order")
  return tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { lines: true, supplier: { select: { name: true } } } })
}

export async function updatePurchaseOrder(ctx: TenantContext, id: string, input: PurchaseOrderOutput) {
  await validatePoRefs(ctx, input)
  const p = priceLines(input)
  return prisma.$transaction(async (tx) => {
    const po = await lockPo(tx, ctx.companyId, id)
    assertBranch(ctx, po.branchId)
    if (!canEditPo(po.status as PoStatus, po.lines)) throw businessRule("Only pending orders with nothing received can be edited")
    if (input.branchId !== po.branchId) throw businessRule("The branch of an existing order cannot be changed")
    await tx.purchaseOrderLine.deleteMany({ where: { poId: po.id } })
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        supplierId: input.supplierId,
        invoiceReference: input.invoiceReference,
        bankDetails: input.bankDetails,
        orderDate: toDateOnly(input.orderDate),
        expectedDate: input.expectedDate ? toDateOnly(input.expectedDate) : null,
        currency: input.currency,
        exchangeRate: p.rate,
        totalForeign: p.totalForeign,
        totalBdt: p.totalBdt,
        notes: input.notes,
        lines: { create: p.lines },
      },
    })
    await audit(
      ctx,
      {
        action: "update",
        entityType: "purchase_order",
        entityId: po.id,
        summary: `Updated purchase order ${po.number}`,
        before: { supplierId: po.supplierId, totalBdt: po.totalBdt.toString(), lines: po.lines.map((l) => ({ variationId: l.variationId, quantity: l.quantity.toString(), unitPriceBdt: l.unitPriceBdt.toString() })) },
        after: { supplierId: input.supplierId, totalBdt: p.totalBdt.toString(), lines: input.lines },
      },
      tx,
    )
    return { id: po.id, number: po.number }
  }, TX_OPTS)
}

/** PO-03: pending → cancelled; partially received → cancel the unreceived remainder (status becomes received). */
export async function cancelPurchaseOrder(ctx: TenantContext, id: string, reason: string | null) {
  return prisma.$transaction(async (tx) => {
    const po = await lockPo(tx, ctx.companyId, id)
    assertBranch(ctx, po.branchId)
    const r = cancelRemainder(po.status as PoStatus, po.lines)
    if ("error" in r) throw businessRule(r.error!)
    for (const l of r.lines) await tx.purchaseOrderLine.update({ where: { id: l.line.id }, data: { cancelledQty: l.cancelledQty.toString() } })
    const note = reason ? `${po.notes ? `${po.notes}\n` : ""}Cancelled: ${reason}` : po.notes
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: r.status, notes: note } })
    const partial = r.status === "received"
    await audit(
      ctx,
      {
        action: "update",
        entityType: "purchase_order",
        entityId: po.id,
        summary: partial ? `Cancelled the unreceived remainder of ${po.number}` : `Cancelled purchase order ${po.number}`,
        before: { status: po.status },
        after: { status: r.status, reason },
      },
      tx,
    )
    return { id: po.id, status: r.status }
  }, TX_OPTS)
}

/** Full PO detail for the detail/edit pages. */
export async function getPurchaseOrder(ctx: TenantContext, id: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { lines: true, supplier: { select: { id: true, code: true, name: true, country: true, currency: true } } },
  })
  if (!po) return null
  assertBranch(ctx, po.branchId)
  const showCost = can(ctx, "inventory.view_cost") || can(ctx, "purchase.create") || can(ctx, "purchase.update")
  const [vars, lc, receipts, branches] = await Promise.all([
    variationInfo(prisma, ctx.companyId, po.lines.map((l) => l.variationId)),
    po.lcId ? prisma.lc.findFirst({ where: { id: po.lcId, companyId: ctx.companyId }, select: { id: true, lcNumber: true, status: true } }) : null,
    prisma.goodsReceipt.findMany({ where: { companyId: ctx.companyId, poId: po.id }, orderBy: { createdAt: "asc" }, include: { lines: true } }),
    branchMap(prisma, ctx.companyId),
  ])
  return {
    id: po.id,
    number: po.number,
    status: po.status as PoStatus,
    branchId: po.branchId,
    branchName: branches.get(po.branchId)?.name ?? "—",
    supplier: po.supplier,
    lc,
    invoiceReference: po.invoiceReference,
    bankDetails: po.bankDetails,
    orderDate: isoDate(po.orderDate)!,
    expectedDate: isoDate(po.expectedDate),
    currency: po.currency,
    exchangeRate: num(po.exchangeRate),
    totalForeign: num(po.totalForeign),
    totalBdt: showCost ? num(po.totalBdt) : null,
    notes: po.notes,
    createdAt: po.createdAt.toISOString(),
    editable: canEditPo(po.status as PoStatus, po.lines),
    showCost,
    lines: po.lines.map((l) => {
      const v = vars.get(l.variationId)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: v?.productName ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.unit ?? "pcs",
        quantity: num(l.quantity),
        receivedQty: num(l.receivedQty),
        cancelledQty: num(l.cancelledQty),
        remaining: num(lineRemaining(l).toString()),
        unitPriceForeign: showCost && l.unitPriceForeign != null ? num(l.unitPriceForeign) : null,
        unitPriceBdt: showCost ? num(l.unitPriceBdt) : null,
        lineTotal: showCost ? num(round2(l.quantity.times(l.unitPriceBdt))) : null,
      }
    }),
    receipts: receipts.map((r) => ({
      id: r.id,
      number: r.number,
      date: isoDate(r.date)!,
      branchName: branches.get(r.branchId)?.name ?? "—",
      quantity: num(sum(r.lines.map((l) => l.quantity))),
    })),
  }
}
export type PurchaseOrderDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseOrder>>>

// ───────────────────────────── Goods receipt ─────────────────────────────

/** Lines that can still be received for a PO (for the receive form). */
export async function poReceivable(ctx: TenantContext, poId: string) {
  const po = await getPurchaseOrder(ctx, poId)
  if (!po) throw notFound("Purchase order")
  return po
}

/**
 * LC receivability (LC-10): LC must be received / cost finalised and have a current landed-cost snapshot.
 * Returns the LC lines with remaining qty and landed unit cost, or a `blocked` reason.
 */
export async function lcReceivable(ctx: TenantContext, lcId: string) {
  const lc = await prisma.lc.findFirst({
    where: { id: lcId, companyId: ctx.companyId },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      supplier: { select: { name: true } },
      snapshots: { where: { isCurrent: true }, orderBy: { version: "desc" }, take: 1, include: { lines: true } },
    },
  })
  if (!lc) throw notFound("LC")
  const snapshot = lc.snapshots[0] ?? null
  let blocked: string | null = null
  if (lc.status !== "received" && lc.status !== "cost_finalized")
    blocked = `This LC is "${lc.status.replaceAll("_", " ")}". Mark it as received before receiving its goods into stock.`
  else if (!snapshot) blocked = "Calculate landed cost first — goods are received at their landed unit cost."
  const vars = await variationInfo(prisma, ctx.companyId, lc.lines.map((l) => l.variationId))
  const costByLine = new Map(snapshot?.lines.map((l) => [l.lcLineId, l.landedUnitCost]) ?? [])
  const showCost = can(ctx, "inventory.view_cost")
  const branches = await branchMap(prisma, ctx.companyId)
  return {
    id: lc.id,
    lcNumber: lc.lcNumber,
    status: lc.status,
    supplierName: lc.supplier.name,
    branchId: lc.branchId,
    branchName: branches.get(lc.branchId)?.name ?? "—",
    snapshotVersion: snapshot?.version ?? null,
    blocked,
    showCost,
    lines: lc.lines.map((l) => {
      const v = vars.get(l.variationId)
      const cost = costByLine.get(l.id)
      const remaining = dec(l.quantity).minus(l.receivedQty)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: v?.productName ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.unit ?? "pcs",
        quantity: num(l.quantity),
        receivedQty: num(l.receivedQty),
        remaining: remaining.gt(0) ? num(remaining) : 0,
        unitCost: showCost && cost != null ? num(cost) : null,
        costMissing: snapshot != null && cost == null,
      }
    }),
  }
}

export async function createGoodsReceipt(ctx: TenantContext, input: GoodsReceiptOutput) {
  assertBranch(ctx, input.branchId)
  const branch = scopedBranch(ctx, input.branchId)
  const lines = input.lines.filter((l) => l.quantity > 0)
  if (new Set(lines.map((l) => l.lineId)).size !== lines.length) throw businessRule("Each line can appear only once")
  return input.source === "po" ? receivePo(ctx, input, branch, lines) : receiveLc(ctx, input, branch, lines)
}

type Branch = { id: string; code: string; name: string }
type InLine = { lineId: string; quantity: number }

async function receivePo(ctx: TenantContext, input: GoodsReceiptOutput, branch: Branch, lines: InLine[]) {
  return prisma.$transaction(async (tx) => {
    const po = await lockPo(tx, ctx.companyId, input.sourceId)
    assertBranch(ctx, po.branchId)
    if (po.status === "cancelled" || po.status === "received") throw businessRule(`Purchase order ${po.number} is ${po.status} — nothing left to receive`)
    const vars = await variationInfo(tx, ctx.companyId, po.lines.map((l) => l.variationId))
    const date = toDateOnly(input.date)
    const at = movementTime(input.date)
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "GRN", branchId: branch.id, branchCode: branch.code, date: at })
    const receipt = await tx.goodsReceipt.create({
      data: { companyId: ctx.companyId, branchId: branch.id, poId: po.id, number, date, note: input.note, createdById: ctx.userId },
    })
    const received = new Map<string, Prisma.Decimal>()
    const posted: { quantity: Prisma.Decimal; unitCost: Prisma.Decimal }[] = []
    for (const l of lines) {
      const pl = po.lines.find((x) => x.id === l.lineId)
      if (!pl) throw businessRule("A line does not belong to this purchase order")
      const label = vars.get(pl.variationId)?.label ?? "this item"
      const qty = dec(l.quantity)
      const problem = receiptQtyProblem(lineRemaining(pl).toString(), qty.toString(), label)
      if (problem) throw businessRule(problem)
      const grl = await tx.goodsReceiptLine.create({
        data: { receiptId: receipt.id, variationId: pl.variationId, poLineId: pl.id, quantity: qty, unitCost: pl.unitPriceBdt },
      })
      await receiveStock(tx, {
        companyId: ctx.companyId,
        branchId: branch.id,
        variationId: pl.variationId,
        quantity: qty,
        unitCost: pl.unitPriceBdt,
        source: "purchase",
        type: "purchase_in",
        batchNo: number,
        poId: po.id,
        receiptLineId: grl.id,
        receivedAt: at,
        refType: "grn",
        refId: receipt.id,
        userId: ctx.userId,
        note: `Received against ${po.number}`,
      })
      await tx.purchaseOrderLine.update({ where: { id: pl.id }, data: { receivedQty: { increment: qty } } })
      received.set(pl.id, qty)
      posted.push({ quantity: qty, unitCost: pl.unitPriceBdt })
    }
    const status = poStatusFor(po.lines.map((pl) => ({ ...pl, receivedQty: dec(pl.receivedQty).plus(received.get(pl.id) ?? 0) })))
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status } })
    const total = round2(sum(posted.map((p) => round2(p.quantity.times(p.unitCost)))))
    if (total.gt(0))
      await postSupplierLedger(tx, {
        companyId: ctx.companyId,
        supplierId: po.supplierId,
        type: "purchase",
        credit: total,
        refType: "grn",
        refId: receipt.id,
        note: `Goods received ${number} (${po.number})`,
        date: at,
        userId: ctx.userId,
      })
    await audit(
      ctx,
      {
        action: "create",
        entityType: "goods_receipt",
        entityId: receipt.id,
        summary: `Received ${number} against ${po.number} — ৳${total.toFixed(2)}`,
        after: { number, poId: po.id, branchId: branch.id, total: total.toString(), lines },
      },
      tx,
    )
    return { id: receipt.id, number, poStatus: status }
  }, TX_OPTS)
}

async function receiveLc(ctx: TenantContext, input: GoodsReceiptOutput, branch: Branch, lines: InLine[]) {
  assertFeature(ctx, "lc")
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM lcs WHERE id = ${input.sourceId} AND companyId = ${ctx.companyId} FOR UPDATE`
    if (!row) throw notFound("LC")
    const lc = await tx.lc.findUniqueOrThrow({
      where: { id: input.sourceId },
      include: { lines: true, snapshots: { where: { isCurrent: true }, orderBy: { version: "desc" }, take: 1, include: { lines: true } } },
    })
    if (lc.status !== "received" && lc.status !== "cost_finalized")
      throw businessRule(`LC ${lc.lcNumber} must be marked received before its goods can be received into stock`)
    const snapshot = lc.snapshots[0]
    if (!snapshot) throw businessRule("Calculate landed cost first")
    const vars = await variationInfo(tx, ctx.companyId, lc.lines.map((l) => l.variationId))
    const date = toDateOnly(input.date)
    const at = movementTime(input.date)
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "GRN", branchId: branch.id, branchCode: branch.code, date: at })
    const receipt = await tx.goodsReceipt.create({
      data: { companyId: ctx.companyId, branchId: branch.id, lcId: lc.id, number, date, note: input.note, createdById: ctx.userId },
    })
    let value = dec(0)
    for (const l of lines) {
      const ll = lc.lines.find((x) => x.id === l.lineId)
      if (!ll) throw businessRule("A line does not belong to this LC")
      const label = vars.get(ll.variationId)?.label ?? "this item"
      const cost = snapshot.lines.find((c) => c.lcLineId === ll.id)
      if (!cost) throw businessRule(`Landed cost is missing for ${label}. Recalculate landed cost first.`)
      const qty = dec(l.quantity)
      const remaining = dec(ll.quantity).minus(ll.receivedQty)
      const problem = receiptQtyProblem(remaining.toString(), qty.toString(), label)
      if (problem) throw businessRule(problem)
      const grl = await tx.goodsReceiptLine.create({
        data: { receiptId: receipt.id, variationId: ll.variationId, lcLineId: ll.id, quantity: qty, unitCost: cost.landedUnitCost },
      })
      await receiveStock(tx, {
        companyId: ctx.companyId,
        branchId: branch.id,
        variationId: ll.variationId,
        quantity: qty,
        unitCost: cost.landedUnitCost,
        source: "lc",
        type: "purchase_in",
        batchNo: number,
        lcId: lc.id,
        receiptLineId: grl.id,
        receivedAt: at,
        refType: "grn",
        refId: receipt.id,
        userId: ctx.userId,
        note: `Received from LC ${lc.lcNumber}`,
      })
      // guarded increment: never exceed the ordered quantity even under concurrency
      const upd = await tx.lcProductLine.updateMany({
        where: { id: ll.id, companyId: ctx.companyId, receivedQty: { lte: dec(ll.quantity).minus(qty) } },
        data: { receivedQty: { increment: qty } },
      })
      if (upd.count !== 1) throw businessRule(`Cannot receive more than ordered for ${label}`)
      value = value.plus(qty.times(cost.landedUnitCost))
    }
    await audit(
      ctx,
      {
        action: "create",
        entityType: "goods_receipt",
        entityId: receipt.id,
        summary: `Received ${number} from LC ${lc.lcNumber} at landed cost — ৳${round2(value).toFixed(2)}`,
        after: { number, lcId: lc.id, snapshotVersion: snapshot.version, branchId: branch.id, value: round2(value).toString(), lines },
      },
      tx,
    )
    return { id: receipt.id, number }
  }, TX_OPTS)
}

export async function getGoodsReceipt(ctx: TenantContext, id: string) {
  const r = await prisma.goodsReceipt.findFirst({ where: { id, companyId: ctx.companyId }, include: { lines: true } })
  if (!r) return null
  assertBranch(ctx, r.branchId)
  const showCost = can(ctx, "inventory.view_cost")
  const [vars, branches, po, lc, user] = await Promise.all([
    variationInfo(prisma, ctx.companyId, r.lines.map((l) => l.variationId)),
    branchMap(prisma, ctx.companyId),
    r.poId
      ? prisma.purchaseOrder.findFirst({ where: { id: r.poId, companyId: ctx.companyId }, select: { id: true, number: true, supplier: { select: { name: true } } } })
      : null,
    r.lcId
      ? prisma.lc.findFirst({ where: { id: r.lcId, companyId: ctx.companyId }, select: { id: true, lcNumber: true, supplier: { select: { name: true } } } })
      : null,
    r.createdById ? prisma.user.findFirst({ where: { id: r.createdById, companyId: ctx.companyId }, select: { name: true } }) : null,
  ])
  const total = round2(sum(r.lines.map((l) => l.quantity.times(l.unitCost))))
  return {
    id: r.id,
    number: r.number,
    date: isoDate(r.date)!,
    note: r.note,
    branchName: branches.get(r.branchId)?.name ?? "—",
    po: po ? { id: po.id, number: po.number } : null,
    lc: lc ? { id: lc.id, lcNumber: lc.lcNumber } : null,
    supplierName: po?.supplier.name ?? lc?.supplier.name ?? "—",
    createdBy: user?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    showCost,
    total: showCost ? num(total) : null,
    lines: r.lines.map((l) => {
      const v = vars.get(l.variationId)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: v?.productName ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.unit ?? "pcs",
        quantity: num(l.quantity),
        unitCost: showCost ? num(l.unitCost) : null,
        lineTotal: showCost ? num(round2(l.quantity.times(l.unitCost))) : null,
      }
    }),
  }
}
export type GoodsReceiptDetail = NonNullable<Awaited<ReturnType<typeof getGoodsReceipt>>>
