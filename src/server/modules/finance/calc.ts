// Pure finance math (FIN-01, FIN-02). No DB / "server-only" import so it can be unit tested.
// All money math is done with decimal.js; callers feed it the aggregates read from the database.
import Decimal from "decimal.js"

export type Amount = Decimal.Value | { toString(): string } | null | undefined

export const D = (v: Amount) => new Decimal(v == null || v === "" ? 0 : typeof v === "number" || typeof v === "string" ? v : v.toString())
export const total = (vals: Amount[]) => vals.reduce<Decimal>((a, v) => a.plus(D(v)), new Decimal(0))
export const r2 = (v: Amount) => D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
/** Decimal → JSON number (2 dp) for client props. */
export const n2 = (v: Amount) => r2(v).toNumber()

// ───────── Daily cash closing (FIN-01, EXP-03) ─────────

export type CashDayInput = {
  openingCash: Amount
  cashSales: Amount
  cashReceipts: Amount
  cashExpenses: Amount
  cashPayouts: Amount
  countedCash?: Amount
}

export type CashDayResult = {
  openingCash: Decimal
  cashSales: Decimal
  cashReceipts: Decimal
  cashIn: Decimal
  cashExpenses: Decimal
  cashPayouts: Decimal
  cashOut: Decimal
  expectedClosing: Decimal
  countedCash: Decimal | null
  /** counted − expected: positive = over, negative = short */
  difference: Decimal | null
  status: "balanced" | "over" | "short" | "open"
}

/** Opening + cash sales + cash receipts − cash expenses − cash payouts = expected closing. */
export function computeCashDay(i: CashDayInput): CashDayResult {
  const openingCash = r2(i.openingCash)
  const cashSales = r2(i.cashSales)
  const cashReceipts = r2(i.cashReceipts)
  const cashExpenses = r2(i.cashExpenses)
  const cashPayouts = r2(i.cashPayouts)
  const cashIn = cashSales.plus(cashReceipts)
  const cashOut = cashExpenses.plus(cashPayouts)
  const expectedClosing = openingCash.plus(cashIn).minus(cashOut)
  const counted = i.countedCash == null || i.countedCash === "" ? null : r2(i.countedCash)
  const difference = counted == null ? null : counted.minus(expectedClosing)
  const status = difference == null ? "open" : difference.isZero() ? "balanced" : difference.isPositive() ? "over" : "short"
  return { openingCash, cashSales, cashReceipts, cashIn, cashExpenses, cashPayouts, cashOut, expectedClosing, countedCash: counted, difference, status }
}

/**
 * Opening cash for a day = counted cash of the most recent earlier closing for the branch.
 * The very first closing has no history: the user-entered opening (or 0) is used.
 */
export function openingCashFor(previous: { countedCash: Amount } | null | undefined, firstOpening?: Amount) {
  if (previous) return { openingCash: r2(previous.countedCash), isFirst: false }
  return { openingCash: r2(firstOpening ?? 0), isFirst: true }
}

// ───────── Profit & loss (FIN-02) ─────────

export type PnlInput = {
  /** Σ Invoice.total (not cancelled) */
  sales: Amount
  /** Σ Invoice.costTotal (not cancelled) */
  salesCost: Amount
  /** Σ approved SalesReturn.totalAmount */
  returns: Amount
  /** Σ approved SalesReturn.costAmount */
  returnsCost: Amount
  /** operating expenses (allocateToLc = false) grouped by category */
  expenses: { key: string; name: string; amount: Amount }[]
}

export type PnlResult = {
  sales: Decimal
  returns: Decimal
  netRevenue: Decimal
  cogs: Decimal
  grossProfit: Decimal
  /** % of net revenue, 2 dp; null when there is no revenue */
  grossMargin: number | null
  expenses: { key: string; name: string; amount: Decimal }[]
  operatingExpenses: Decimal
  netProfit: Decimal
  netMargin: number | null
}

const pct = (part: Decimal, whole: Decimal) => (whole.isZero() ? null : part.div(whole).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber())

/** Revenue − returns − COGS (net of returned cost) − operating expenses = net profit. */
export function computePnl(i: PnlInput): PnlResult {
  const sales = r2(i.sales)
  const returns = r2(i.returns)
  const netRevenue = sales.minus(returns)
  const cogs = r2(i.salesCost).minus(r2(i.returnsCost))
  const grossProfit = netRevenue.minus(cogs)
  const merged = new Map<string, { key: string; name: string; amount: Decimal }>()
  for (const e of i.expenses) {
    const cur = merged.get(e.key)
    if (cur) cur.amount = cur.amount.plus(r2(e.amount))
    else merged.set(e.key, { key: e.key, name: e.name, amount: r2(e.amount) })
  }
  const expenses = [...merged.values()].filter((e) => !e.amount.isZero()).sort((a, b) => b.amount.comparedTo(a.amount) || a.name.localeCompare(b.name))
  const operatingExpenses = total(expenses.map((e) => e.amount))
  const netProfit = grossProfit.minus(operatingExpenses)
  return {
    sales,
    returns,
    netRevenue,
    cogs,
    grossProfit,
    grossMargin: pct(grossProfit, netRevenue),
    expenses,
    operatingExpenses,
    netProfit,
    netMargin: pct(netProfit, netRevenue),
  }
}

export type PeriodAgg = { key: string; sales?: Amount; salesCost?: Amount; returns?: Amount; returnsCost?: Amount; expenses?: Amount }

export type PeriodRow = {
  key: string
  netRevenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  grossMargin: number | null
}

/**
 * Merges per-period aggregates (invoices, returns, expenses each grouped by the same period key)
 * into one P&L row per key, in the order of `keys` (periods without activity become zero rows).
 */
export function pnlByPeriod(keys: string[], rows: PeriodAgg[]): PeriodRow[] {
  const acc = new Map<string, { sales: Decimal; salesCost: Decimal; returns: Decimal; returnsCost: Decimal; expenses: Decimal }>()
  for (const k of keys) acc.set(k, { sales: D(0), salesCost: D(0), returns: D(0), returnsCost: D(0), expenses: D(0) })
  for (const r of rows) {
    const a = acc.get(r.key)
    if (!a) continue
    a.sales = a.sales.plus(D(r.sales))
    a.salesCost = a.salesCost.plus(D(r.salesCost))
    a.returns = a.returns.plus(D(r.returns))
    a.returnsCost = a.returnsCost.plus(D(r.returnsCost))
    a.expenses = a.expenses.plus(D(r.expenses))
  }
  return keys.map((key) => {
    const a = acc.get(key)!
    const p = computePnl({ ...a, expenses: [{ key: "all", name: "Expenses", amount: a.expenses }] })
    return {
      key,
      netRevenue: n2(p.netRevenue),
      cogs: n2(p.cogs),
      grossProfit: n2(p.grossProfit),
      expenses: n2(p.operatingExpenses),
      netProfit: n2(p.netProfit),
      grossMargin: p.grossMargin,
    }
  })
}

// ───────── Calendar helpers (local business day, yyyy-mm-dd keys) ─────────

const pad = (n: number) => String(n).padStart(2, "0")

/** Local calendar day key of a timestamp. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
export const isDayKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime())

/** [start, end) of a local business day, for DateTime columns. */
export function dayBounds(key: string) {
  const start = new Date(`${key}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { gte: start, lt: end }
}

/** [start of `from`, start of the day after `to`) for DateTime columns. */
export function rangeBounds(from: string, to: string) {
  return { gte: dayBounds(from).gte, lt: dayBounds(to).lt }
}

/** A `@db.Date` column value for a day key (UTC midnight, so the stored date is exactly the key). */
export const dbDate = (key: string) => new Date(`${key}T00:00:00.000Z`)
/** Day key of a `@db.Date` column value. */
export const dbDateKey = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T12:00:00`)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Inclusive list of day keys between two keys (max ~1 year). */
export function dayKeysBetween(from: string, to: string) {
  const out: string[] = []
  for (let k = from; k <= to && out.length < 400; k = addDays(k, 1)) out.push(k)
  return out
}

export const monthKeysOfYear = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`)

/** First and last day keys of a yyyy-mm month. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${pad(last)}` }
}

// ───────── P&L period selection ─────────

export type PeriodKind = "day" | "month" | "range"
export type ResolvedPeriod = { kind: PeriodKind; from: string; to: string; label: string; date: string; month: string; year: number }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`

/** Resolves ?period=day|month|range&date=&month=&from=&to=&year= into an inclusive day range (defaults: this month). */
export function resolvePeriod(get: (k: string) => string | undefined, today: string): ResolvedPeriod {
  const kind: PeriodKind = (["day", "month", "range"] as const).find((k) => k === get("period")) ?? "month"
  const date = isDayKey(get("date")) ? get("date")! : today
  const m = get("month")
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : today.slice(0, 7)
  const y = Number(get("year"))
  let from: string
  let to: string
  let label: string
  if (kind === "day") {
    from = to = date
    label = date
  } else if (kind === "range") {
    from = isDayKey(get("from")) ? get("from")! : `${today.slice(0, 7)}-01`
    to = isDayKey(get("to")) ? get("to")! : today
    if (from > to) [from, to] = [to, from]
    // keep reports bounded (≈ 2 years)
    if (addDays(from, 731) < to) from = addDays(to, -731)
    label = `${from} → ${to}`
  } else {
    ;({ from, to } = monthRange(month))
    label = monthLabel(month)
  }
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : Number(to.slice(0, 4))
  return { kind, from, to, label, date, month, year }
}
