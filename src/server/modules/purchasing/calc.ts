/**
 * Pure purchasing rules (no DB, no "server-only") so they can be unit-tested.
 * Accepts Prisma Decimals, numbers or strings; returns decimal.js values.
 */
import Decimal from "decimal.js"

export type DecLike = Decimal.Value | { toString(): string } | null | undefined
export const d = (v: DecLike) => new Decimal(v == null || v === "" ? 0 : typeof v === "object" ? v.toString() : v)

export type PoStatus = "pending" | "partially_received" | "received" | "cancelled"
export type PoLineQty = { quantity: DecLike; receivedQty: DecLike; cancelledQty: DecLike }

/** Quantity still to be received on a PO line (never negative). */
export function lineRemaining(l: PoLineQty) {
  const r = d(l.quantity).minus(d(l.receivedQty)).minus(d(l.cancelledQty))
  return r.isNegative() ? new Decimal(0) : r
}

/**
 * PO status from its lines (PO-02/03):
 * nothing open → received (if anything arrived) or cancelled; otherwise partially_received / pending.
 */
export function poStatusFor(lines: PoLineQty[]): PoStatus {
  if (lines.length === 0) return "pending"
  const open = lines.reduce((a, l) => a.plus(lineRemaining(l)), new Decimal(0))
  const anyReceived = lines.some((l) => d(l.receivedQty).gt(0))
  if (open.lte(0)) return anyReceived ? "received" : "cancelled"
  return anyReceived ? "partially_received" : "pending"
}

/**
 * PO-03: cancel a pending order, or only the unreceived remainder of a partially received one.
 * Returns the new cancelledQty per line and the resulting status, or an error message.
 */
export function cancelRemainder<L extends PoLineQty>(status: PoStatus, lines: L[]) {
  if (status === "cancelled") return { error: "This order is already cancelled" } as const
  if (status === "received") return { error: "This order has been fully received — nothing left to cancel" } as const
  const next = lines.map((l) => ({ line: l, cancelledQty: Decimal.max(d(l.quantity).minus(d(l.receivedQty)), 0) }))
  const anyReceived = lines.some((l) => d(l.receivedQty).gt(0))
  return { lines: next, status: (anyReceived ? "received" : "cancelled") as PoStatus }
}

/** Lines (and supplier/date) may only be edited while the order is pending and nothing has been received. */
export function canEditPo(status: PoStatus, lines: { receivedQty: DecLike }[]) {
  return status === "pending" && lines.every((l) => d(l.receivedQty).lte(0))
}

/** Unit price in BDT (4 dp): local purchases are already BDT, foreign prices × exchange rate. */
export function toBdt(unitPrice: DecLike, currency: string, exchangeRate: DecLike) {
  const p = d(unitPrice)
  return (currency === "BDT" ? p : p.times(d(exchangeRate))).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
}

/** Validate a requested receipt quantity against what is still open. Returns an error message or null. */
export function receiptQtyProblem(remaining: DecLike, requested: DecLike, label = "this item") {
  const r = d(requested)
  if (r.isNegative()) return `Quantity for ${label} cannot be negative`
  if (r.gt(d(remaining))) return `Only ${d(remaining).toString()} left to receive for ${label}`
  return null
}

/** Σ qty × unit cost, rounded to 2 dp (supplier payable for a local GRN). */
export function extendedTotal(lines: { quantity: DecLike; unitCost: DecLike }[]) {
  return lines
    .reduce((a, l) => a.plus(d(l.quantity).times(d(l.unitCost)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)), new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}
