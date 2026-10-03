/**
 * Pure inventory-operation rules (no DB, no "server-only") so they can be unit-tested.
 */
import Decimal from "decimal.js"
import { d, type DecLike } from "@/server/modules/purchasing/calc"

export type TransferStatus = "pending" | "completed" | "cancelled"

/** Combine duplicate variations into one line (summing quantities), keeping first-seen order. */
export function mergeLines<L extends { variationId: string; quantity: DecLike }>(lines: L[]) {
  const map = new Map<string, L & { qty: Decimal }>()
  for (const l of lines) {
    const prev = map.get(l.variationId)
    if (prev) prev.qty = prev.qty.plus(d(l.quantity))
    else map.set(l.variationId, { ...l, qty: d(l.quantity) })
  }
  return [...map.values()]
}

/**
 * Transfer request checks: different branches, user may dispatch from the source branch,
 * destination is an active company branch, at least one positive line.
 * Returns an error message or null.
 */
export function transferProblem(
  t: { fromBranchId: string; toBranchId: string; lines: { variationId: string; quantity: DecLike }[] },
  scope: { userBranchIds: string[]; activeBranchIds: string[] },
) {
  if (!t.fromBranchId || !t.toBranchId) return "Choose both branches"
  if (t.fromBranchId === t.toBranchId) return "Source and destination must be different branches"
  if (!scope.userBranchIds.includes(t.fromBranchId)) return "You do not have access to the source branch"
  if (!scope.activeBranchIds.includes(t.toBranchId)) return "The destination branch is not an active branch"
  if (t.lines.length === 0) return "Add at least one product"
  if (t.lines.some((l) => d(l.quantity).lte(0))) return "Quantities must be more than zero"
  return null
}

/** What a user may do with a transfer in its current status. */
export function transferActions(
  t: { status: TransferStatus; fromBranchId: string; toBranchId: string },
  userBranchIds: string[],
) {
  const pending = t.status === "pending"
  return {
    canReceive: pending && userBranchIds.includes(t.toBranchId),
    canCancel: pending && userBranchIds.includes(t.fromBranchId),
  }
}

/** Split signed adjustment lines into stock-in and stock-out sets. */
export function splitAdjustment<L extends { quantity: DecLike }>(lines: L[]) {
  return {
    ins: lines.filter((l) => d(l.quantity).gt(0)),
    outs: lines.filter((l) => d(l.quantity).lt(0)),
  }
}

/** Σ qty × unit cost at 4 dp precision then 2 dp (stock value). */
export function stockValue(batches: { qtyAvailable: DecLike; unitCost: DecLike }[]) {
  return batches
    .reduce((a, b) => a.plus(d(b.qtyAvailable).times(d(b.unitCost))), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/** Low stock = reorder level set (> 0) and on-hand at or below it. */
export function isLowStock(onHand: DecLike, reorderLevel: DecLike) {
  return d(reorderLevel).gt(0) && d(onHand).lte(d(reorderLevel))
}
