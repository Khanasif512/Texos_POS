import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { businessRule } from "@/server/errors"
import { dec, round4, type Dec } from "@/server/decimal"

type Tx = Prisma.TransactionClient
type StockTxnType = Prisma.StockLedgerEntryCreateInput["type"]
type BatchSource = Prisma.InventoryBatchCreateInput["source"]

type Ref = { refType: string; refId: string; userId?: string | null; note?: string | null }

/** Update the cached branch balance and return the new quantity. */
async function bumpBalance(tx: Tx, companyId: string, branchId: string, variationId: string, delta: Dec) {
  const row = await tx.stockBalance.upsert({
    where: { branchId_variationId: { branchId, variationId } },
    create: { companyId, branchId, variationId, quantity: delta },
    update: { quantity: { increment: delta } },
  })
  return dec(row.quantity)
}

/**
 * Stock IN (INV-04): creates a costing batch, bumps the balance and writes the ledger row.
 * Used by goods receipt (LC/PO), opening stock, positive adjustments, transfer-in.
 */
export async function receiveStock(
  tx: Tx,
  args: Ref & {
    companyId: string
    branchId: string
    variationId: string
    quantity: Prisma.Decimal | number | string
    unitCost: Prisma.Decimal | number | string
    source: BatchSource
    type?: StockTxnType
    batchNo: string
    lcId?: string | null
    poId?: string | null
    receiptLineId?: string | null
    receivedAt?: Date
  },
) {
  const qty = dec(args.quantity)
  if (qty.lte(0)) throw businessRule("Quantity must be greater than zero")
  const batch = await tx.inventoryBatch.create({
    data: {
      companyId: args.companyId,
      branchId: args.branchId,
      variationId: args.variationId,
      source: args.source,
      lcId: args.lcId ?? null,
      poId: args.poId ?? null,
      receiptLineId: args.receiptLineId ?? null,
      batchNo: args.batchNo,
      qtyReceived: qty,
      qtyAvailable: qty,
      unitCost: round4(args.unitCost),
      receivedAt: args.receivedAt ?? new Date(),
    },
  })
  const balance = await bumpBalance(tx, args.companyId, args.branchId, args.variationId, qty)
  await tx.stockLedgerEntry.create({
    data: {
      companyId: args.companyId,
      branchId: args.branchId,
      variationId: args.variationId,
      batchId: batch.id,
      type: args.type ?? "purchase_in",
      quantity: qty,
      balanceAfter: balance,
      unitCost: batch.unitCost,
      refType: args.refType,
      refId: args.refId,
      note: args.note ?? null,
      createdById: args.userId ?? null,
    },
  })
  return batch
}

export type Allocation = { batchId: string; quantity: Dec; unitCost: Dec }

/**
 * Stock OUT using FIFO across available batches (INV-02, SLS-02). Locks the batch rows,
 * fails when stock is insufficient, writes one ledger row per batch consumed.
 * Returns the allocations and weighted unit cost — snapshot these on the document (SLS-10).
 */
export async function issueStockFIFO(
  tx: Tx,
  args: Ref & { companyId: string; branchId: string; variationId: string; quantity: Prisma.Decimal | number | string; type?: StockTxnType; label?: string },
) {
  let remaining = dec(args.quantity)
  if (remaining.lte(0)) throw businessRule("Quantity must be greater than zero")
  const batches = await tx.$queryRaw<{ id: string; qtyAvailable: string; unitCost: string }[]>`
    SELECT id, qtyAvailable, unitCost FROM inventory_batches
    WHERE companyId = ${args.companyId} AND branchId = ${args.branchId} AND variationId = ${args.variationId} AND qtyAvailable > 0
    ORDER BY receivedAt ASC, createdAt ASC
    FOR UPDATE`
  const available = batches.reduce((a, b) => a.plus(dec(b.qtyAvailable)), dec(0))
  if (available.lt(remaining))
    throw businessRule(`Not enough stock for ${args.label ?? "this item"}: ${available.toString()} available, ${remaining.toString()} requested`, {
      variationId: args.variationId,
      available: available.toString(),
    })

  const allocations: Allocation[] = []
  let totalCost = dec(0)
  for (const b of batches) {
    if (remaining.lte(0)) break
    const take = Prisma_min(dec(b.qtyAvailable), remaining)
    await tx.inventoryBatch.update({ where: { id: b.id }, data: { qtyAvailable: { decrement: take } } })
    const balance = await bumpBalance(tx, args.companyId, args.branchId, args.variationId, take.negated())
    await tx.stockLedgerEntry.create({
      data: {
        companyId: args.companyId,
        branchId: args.branchId,
        variationId: args.variationId,
        batchId: b.id,
        type: args.type ?? "sale_out",
        quantity: take.negated(),
        balanceAfter: balance,
        unitCost: dec(b.unitCost),
        refType: args.refType,
        refId: args.refId,
        note: args.note ?? null,
        createdById: args.userId ?? null,
      },
    })
    allocations.push({ batchId: b.id, quantity: take, unitCost: dec(b.unitCost) })
    totalCost = totalCost.plus(take.times(dec(b.unitCost)))
    remaining = remaining.minus(take)
  }
  const qty = dec(args.quantity)
  return { allocations, totalCost, unitCost: round4(totalCost.div(qty)) }
}

function Prisma_min(a: Dec, b: Dec) {
  return a.lt(b) ? a : b
}

/**
 * Put stock back into the exact batches it came from (invoice cancel, approved return with restock).
 * `allocations` are the InvoiceLineBatch rows; quantity may be partial — restored newest-batch-first.
 */
export async function restoreToBatches(
  tx: Tx,
  args: Ref & {
    companyId: string
    branchId: string
    variationId: string
    allocations: { batchId: string; quantity: Prisma.Decimal | number | string; unitCost: Prisma.Decimal | number | string }[]
    quantity: Prisma.Decimal | number | string
    type: StockTxnType
  },
) {
  let remaining = dec(args.quantity)
  for (const a of [...args.allocations].reverse()) {
    if (remaining.lte(0)) break
    const put = Prisma_min(dec(a.quantity), remaining)
    await tx.inventoryBatch.update({ where: { id: a.batchId }, data: { qtyAvailable: { increment: put } } })
    const balance = await bumpBalance(tx, args.companyId, args.branchId, args.variationId, put)
    await tx.stockLedgerEntry.create({
      data: {
        companyId: args.companyId,
        branchId: args.branchId,
        variationId: args.variationId,
        batchId: a.batchId,
        type: args.type,
        quantity: put,
        balanceAfter: balance,
        unitCost: dec(a.unitCost),
        refType: args.refType,
        refId: args.refId,
        note: args.note ?? null,
        createdById: args.userId ?? null,
      },
    })
    remaining = remaining.minus(put)
  }
  if (remaining.gt(0)) throw businessRule("Cannot restore more than was issued")
}

/** Latest known unit cost for a variation in a branch (fallback for positive adjustments). */
export async function lastUnitCost(tx: Tx, companyId: string, branchId: string, variationId: string) {
  const b = await tx.inventoryBatch.findFirst({
    where: { companyId, branchId, variationId },
    orderBy: { receivedAt: "desc" },
    select: { unitCost: true },
  })
  return b ? dec(b.unitCost) : dec(0)
}
