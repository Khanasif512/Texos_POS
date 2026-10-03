// No "server-only" import: pure functions, unit-tested with vitest (tests/sales-totals.test.ts).
import Decimal from "decimal.js"

type Amt = Decimal.Value | { toString(): string } | null | undefined

const D = (v: Amt) => new Decimal(v == null || v === "" ? 0 : v.toString())
const r2 = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
const r4 = (v: Decimal) => v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)

export class SalesCalcError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message)
  }
}

export type TotalsInput = {
  lines: { quantity: Amt; unitPrice: Amt; discount?: Amt }[]
  discount?: Amt
  tax?: Amt
  deliveryCharge?: Amt
}

/**
 * Invoice math (SLS-01): lineTotal = qty × unitPrice − line discount; subtotal = Σ lineTotal;
 * total = subtotal − invoice discount + tax + delivery charge. Everything rounded to 2 dp (half-up).
 */
export function computeTotals(input: TotalsInput) {
  const lines = input.lines.map((l, i) => {
    const qty = D(l.quantity)
    const price = r2(D(l.unitPrice))
    const discount = r2(D(l.discount))
    if (qty.lte(0)) throw new SalesCalcError("Quantity must be greater than zero", `lines.${i}.quantity`)
    if (price.lt(0)) throw new SalesCalcError("Price cannot be negative", `lines.${i}.unitPrice`)
    if (discount.lt(0)) throw new SalesCalcError("Discount cannot be negative", `lines.${i}.discount`)
    const gross = r2(qty.times(price))
    if (discount.gt(gross)) throw new SalesCalcError("Line discount cannot exceed the line amount", `lines.${i}.discount`)
    return { quantity: qty, unitPrice: price, discount, gross, lineTotal: r2(gross.minus(discount)) }
  })
  const subtotal = r2(lines.reduce((a, l) => a.plus(l.lineTotal), new Decimal(0)))
  const discount = r2(D(input.discount))
  const tax = r2(D(input.tax))
  const deliveryCharge = r2(D(input.deliveryCharge))
  if (discount.lt(0) || tax.lt(0) || deliveryCharge.lt(0)) throw new SalesCalcError("Amounts cannot be negative")
  if (discount.gt(subtotal)) throw new SalesCalcError("Discount cannot exceed the subtotal", "discount")
  const total = r2(subtotal.minus(discount).plus(tax).plus(deliveryCharge))
  const lineDiscount = r2(lines.reduce((a, l) => a.plus(l.discount), new Decimal(0)))
  return { lines, subtotal, discount, tax, deliveryCharge, total, lineDiscount, totalDiscount: r2(lineDiscount.plus(discount)) }
}

/** Weighted unit cost (4 dp) from FIFO allocations, and the line cost (2 dp) used for Invoice.costTotal. */
export function weightedCost(allocations: { quantity: Amt; unitCost: Amt }[]) {
  const qty = allocations.reduce((a, x) => a.plus(D(x.quantity)), new Decimal(0))
  const cost = allocations.reduce((a, x) => a.plus(D(x.quantity).times(D(x.unitCost))), new Decimal(0))
  return { unitCost: qty.gt(0) ? r4(cost.div(qty)) : new Decimal(0) }
}

export const lineCost = (quantity: Amt, unitCost: Amt) => r2(D(quantity).times(D(unitCost)))

/** SLS-10: profit = (unitPrice − unitCost) × qty − line discount. */
export const lineProfit = (l: { quantity: Amt; unitPrice: Amt; unitCost: Amt; discount?: Amt }) =>
  r2(D(l.unitPrice).minus(D(l.unitCost)).times(D(l.quantity)).minus(D(l.discount)))

/**
 * CRM-01: a credit sale is blocked when the customer's outstanding balance plus the new due
 * exceeds the credit limit. A limit of 0 means no credit at all. Nothing to check when nothing is due.
 */
export function checkCreditLimit(a: { balance: Amt; creditLimit: Amt; newDue: Amt }) {
  const balance = r2(D(a.balance))
  const limit = r2(D(a.creditLimit))
  const due = r2(D(a.newDue))
  const projected = r2(balance.plus(due))
  const available = Decimal.max(0, r2(limit.minus(balance)))
  const blocked = due.gt(0) && projected.gt(limit)
  return { blocked, balance, creditLimit: limit, due, projected, available, excess: blocked ? r2(projected.minus(limit)) : new Decimal(0) }
}

/**
 * SLS-05: an invoice may be cancelled within `windowHours` of creation (Company.settings.cancelWindowHours,
 * default 24). Owners may cancel at any time.
 */
export function cancelWindow(a: { createdAt: Date; now?: Date; windowHours?: number | null; isOwner?: boolean }) {
  const hours = a.windowHours == null || !Number.isFinite(a.windowHours) || a.windowHours < 0 ? 24 : a.windowHours
  const deadline = new Date(a.createdAt.getTime() + hours * 3_600_000)
  const now = a.now ?? new Date()
  return { open: !!a.isOwner || now.getTime() <= deadline.getTime(), deadline, hours, bypass: !!a.isOwner && now > deadline }
}

/** Reads cancelWindowHours from the free-form Company.settings JSON. */
export function cancelWindowHours(settings: unknown) {
  const v = settings && typeof settings === "object" ? (settings as Record<string, unknown>).cancelWindowHours : undefined
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 24
}

// ───────── Amount in words (Bangladesh: crore / lakh / thousand) ─────────

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function below100(n: number) {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`
}

function below1000(n: number) {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : "", rest ? below100(rest) : ""].filter(Boolean).join(" ")
}

/** Integer to words using the South Asian system (e.g. 1,23,45,678 → One Crore Twenty-Three Lakh …). */
export function integerToWords(value: bigint | number): string {
  let n = BigInt(value)
  if (n === BigInt(0)) return "Zero"
  const parts: string[] = []
  const crore = n / BigInt(10_000_000)
  n %= BigInt(10_000_000)
  if (crore > BigInt(0)) parts.push(`${integerToWords(crore)} Crore`)
  const num = Number(n)
  const lakh = Math.floor(num / 100_000)
  const thousand = Math.floor((num % 100_000) / 1000)
  const rest = num % 1000
  if (lakh) parts.push(`${below100(lakh)} Lakh`)
  if (thousand) parts.push(`${below100(thousand)} Thousand`)
  if (rest) parts.push(below1000(rest))
  return parts.join(" ")
}

/** "Taka One Thousand Two Hundred Fifty and Paisa Fifty Only" — printed on invoices. */
export function amountInWords(amount: Amt) {
  const v = r2(D(amount).abs())
  const taka = BigInt(v.floor().toFixed(0))
  const paisa = Number(v.minus(v.floor()).times(100).toFixed(0))
  const words = `Taka ${integerToWords(taka)}${paisa ? ` and Paisa ${integerToWords(paisa)}` : ""} Only`
  return D(amount).isNegative() ? `Minus ${words}` : words
}
