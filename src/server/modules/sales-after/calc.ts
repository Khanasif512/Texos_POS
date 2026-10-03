/**
 * Pure calculations for after-sale flows (receipt allocation, returns, credit notes, orders).
 * No database or server-only imports so the rules are unit-tested in isolation (tests/sales-after-*.test.ts).
 * Uses decimal.js (the same engine behind Prisma.Decimal) — never JS floats for money.
 */
import Decimal from "decimal.js"

export type Amount = Decimal.Value | { toString(): string } | null | undefined

export const D = (v: Amount) => new Decimal(v == null || v === "" ? 0 : typeof v === "number" || typeof v === "string" ? v : v.toString())
export const r2 = (v: Amount) => D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
const min = (a: Decimal, b: Decimal) => (a.lt(b) ? a : b)
const max0 = (a: Decimal) => (a.isNegative() ? new Decimal(0) : a)

// ───────── Money receipts (SLS-04) ─────────

export type OpenInvoice = { id: string; dueAmount: Amount; date: Date | string }

/**
 * Allocate a payment to open invoices, oldest first. Whatever is left over is an advance.
 * Invoices with the same date keep their input order (pass them sorted by number as a tiebreak).
 */
export function allocateOldestFirst(amount: Amount, invoices: OpenInvoice[]) {
  let remaining = r2(amount)
  const sorted = [...invoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const allocations: { invoiceId: string; amount: Decimal }[] = []
  for (const inv of sorted) {
    if (remaining.lte(0)) break
    const due = r2(inv.dueAmount)
    if (due.lte(0)) continue
    const take = min(due, remaining)
    allocations.push({ invoiceId: inv.id, amount: take })
    remaining = remaining.minus(take)
  }
  return { allocations, advance: remaining }
}

/**
 * Apply unallocated advance receipts (oldest first) to open invoices (oldest first).
 * Returns one row per (receipt, invoice) pair — these become ReceiptAllocation rows.
 */
export function applyAdvances(advances: { id: string; remaining: Amount }[], invoices: OpenInvoice[]) {
  const dues = [...invoices]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((i) => ({ id: i.id, due: r2(i.dueAmount) }))
    .filter((i) => i.due.gt(0))
  const rows: { receiptId: string; invoiceId: string; amount: Decimal }[] = []
  let i = 0
  for (const adv of advances) {
    let left = r2(adv.remaining)
    while (left.gt(0) && i < dues.length) {
      const take = min(left, dues[i].due)
      rows.push({ receiptId: adv.id, invoiceId: dues[i].id, amount: take })
      left = left.minus(take)
      dues[i].due = dues[i].due.minus(take)
      if (dues[i].due.lte(0)) i++
    }
    if (i >= dues.length) break
  }
  return rows
}

// ───────── Returns (SLS-06) ─────────

/** What can still be returned on an invoice line: sold − already returned − held by pending requests. */
export function returnableQty(line: { quantity: Amount; returnedQty: Amount; pendingQty?: Amount }) {
  return max0(D(line.quantity).minus(D(line.returnedQty)).minus(D(line.pendingQty)))
}

/**
 * How much of each line taka the customer was actually charged once invoice-level adjustments apply:
 * (total − delivery charge) ÷ Σ line totals. 1 when there is no invoice-level discount/tax; < 1 with an
 * invoice discount; > 1 with tax. Delivery charges are not refunded on returns.
 */
export function chargeFactor(inv: { lineTotals: Amount[]; total: Amount; deliveryCharge?: Amount }) {
  const lines = inv.lineTotals.reduce<Decimal>((a, v) => a.plus(D(v)), new Decimal(0))
  if (lines.lte(0)) return new Decimal(1)
  const goods = D(inv.total).minus(D(inv.deliveryCharge))
  if (goods.lte(0)) return new Decimal(0)
  return goods.div(lines)
}

/**
 * Refund value of returning `qty` units of an invoice line: qty × unitPrice less the pro-rated share of the
 * line discount, scaled by the invoice's charge factor (invoice discount / tax). When the return completes
 * the line, the amount is the remainder of what was charged so partial returns add up exactly (no stray paisa).
 */
export function returnLineAmount(args: {
  lineQty: Amount
  unitPrice: Amount
  lineDiscount?: Amount
  /** the line's stored total; when given it is the source of truth for the net line value */
  lineTotal?: Amount
  returnQty: Amount
  alreadyReturnedQty?: Amount
  alreadyReturnedAmount?: Amount
  /** from chargeFactor(); defaults to 1 */
  factor?: Amount
}) {
  const lineQty = D(args.lineQty)
  const qty = D(args.returnQty)
  if (lineQty.lte(0) || qty.lte(0)) return new Decimal(0)
  const factor = args.factor == null ? new Decimal(1) : D(args.factor)
  const hasTotal = args.lineTotal != null
  const lineNet = hasTotal ? D(args.lineTotal) : lineQty.times(D(args.unitPrice)).minus(D(args.lineDiscount))
  const lineCharged = r2(lineNet.times(factor))
  const done = D(args.alreadyReturnedQty).plus(qty)
  if (done.gte(lineQty)) return max0(lineCharged.minus(r2(args.alreadyReturnedAmount)))
  const net = hasTotal
    ? lineNet.times(qty).div(lineQty)
    : qty.times(D(args.unitPrice)).minus(r2(D(args.lineDiscount).times(qty).div(lineQty)))
  return max0(r2(net.times(factor)))
}

/**
 * Batches a line can still be restocked into. `allocations` are the line's batches in FIFO (issue) order;
 * restoreToBatches() fills newest-first, so earlier restocked returns used up the newest batches first.
 */
export function restockableBatches<T extends { quantity: Amount }>(allocations: T[], alreadyRestocked: Amount) {
  let used = D(alreadyRestocked)
  const out: (T & { quantity: Decimal })[] = []
  for (const a of [...allocations].reverse()) {
    const q = D(a.quantity)
    const take = min(q, used)
    used = used.minus(take)
    const left = q.minus(take)
    if (left.gt(0)) out.unshift({ ...a, quantity: left })
  }
  return out
}

/** Invoice status after a return is approved. */
export function statusAfterReturn(lines: { quantity: Amount; returnedQty: Amount }[]): "returned" | "partially_returned" {
  return lines.every((l) => D(l.returnedQty).gte(D(l.quantity))) ? "returned" : "partially_returned"
}

/**
 * Refund modes allowed for an invoice. Walk-ins (no customer) can only get cash back.
 * A credit invoice that still has dues must be settled with a credit note (it reduces the due first).
 */
export function allowedRefundModes(inv: { type: "cash" | "credit"; customerId: string | null; dueAmount: Amount }): ("credit_note" | "cash")[] {
  if (!inv.customerId) return ["cash"]
  if (inv.type === "credit" && D(inv.dueAmount).gt(0)) return ["credit_note"]
  return inv.type === "credit" ? ["credit_note", "cash"] : ["cash", "credit_note"]
}

/** A credit note first reduces the invoice's remaining due (never below 0); the rest stays as customer credit. */
export function splitCreditNote(amount: Amount, invoiceDue: Amount) {
  const amt = r2(amount)
  const dueReduction = min(amt, max0(r2(invoiceDue)))
  return { dueReduction, customerCredit: amt.minus(dueReduction) }
}

// ───────── Quotations & orders (SLS-07) ─────────

export function orderTotals(lines: { quantity: Amount; unitPrice: Amount; discount?: Amount }[], discount: Amount = 0) {
  const rows = lines.map((l) => r2(D(l.quantity).times(D(l.unitPrice)).minus(D(l.discount))))
  const subtotal = rows.reduce((a, v) => a.plus(v), new Decimal(0))
  return { lineTotals: rows, subtotal, total: max0(subtotal.minus(r2(discount))) }
}

// ───────── Printing ─────────

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
  "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function below100(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`
}
function below1000(n: number) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} Hundred` : "", r ? below100(r) : ""].filter(Boolean).join(" ")
}
/** Indian/Bangladeshi grouping: crore, lakh, thousand, hundred. */
function integerWords(n: number): string {
  if (n === 0) return "Zero"
  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000)
  n %= 10_000_000
  const lakh = Math.floor(n / 100_000)
  n %= 100_000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  if (crore) parts.push(`${integerWords(crore)} Crore`)
  if (lakh) parts.push(`${below100(lakh)} Lakh`)
  if (thousand) parts.push(`${below100(thousand)} Thousand`)
  if (n) parts.push(below1000(n))
  return parts.join(" ")
}

/** "Taka One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paisa Only" */
export function amountInWords(v: Amount) {
  const amt = r2(v).abs()
  const taka = amt.floor().toNumber()
  const paisa = amt.minus(amt.floor()).times(100).toDecimalPlaces(0).toNumber()
  return `Taka ${integerWords(taka)}${paisa ? ` and ${below100(paisa)} Paisa` : ""} Only`
}
