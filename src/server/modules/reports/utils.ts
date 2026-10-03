/**
 * Pure report helpers (no DB, no "server-only") so they can be unit-tested: date presets, aging buckets,
 * totals, percentage maths and Excel formatting decisions.
 */
import Decimal from "decimal.js"
import type { CellValue, ColumnType, DefaultRange, QuickRange, ReportColumn, ReportRow } from "./types"

// ───────────── Dates ─────────────

const pad = (n: number) => String(n).padStart(2, "0")

/** Local calendar date as yyyy-mm-dd (the server runs in the company timezone). */
export function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Accepts only a real yyyy-mm-dd date. */
export function isYmd(v: string | null | undefined): v is string {
  if (!v || !YMD.test(v)) return false
  const [y, m, d] = v.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function addDays(d: Date, days: number) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + days)
  return r
}

/** Quick ranges shown on every date-range report (Today, Yesterday, This month, Last month, This year, …). */
export function quickRanges(today: Date): QuickRange[] {
  const y = today.getFullYear()
  const m = today.getMonth()
  const t = ymd(today)
  const yesterday = ymd(addDays(today, -1))
  return [
    { key: "today", label: "Today", from: t, to: t },
    { key: "yesterday", label: "Yesterday", from: yesterday, to: yesterday },
    { key: "last_7", label: "Last 7 days", from: ymd(addDays(today, -6)), to: t },
    { key: "this_month", label: "This month", from: ymd(new Date(y, m, 1)), to: t },
    { key: "last_month", label: "Last month", from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) },
    { key: "this_year", label: "This year", from: ymd(new Date(y, 0, 1)), to: t },
    { key: "last_year", label: "Last year", from: ymd(new Date(y - 1, 0, 1)), to: ymd(new Date(y - 1, 11, 31)) },
  ]
}

/** Resolve ?from&to with a report default; swaps reversed ranges. */
export function resolveRange(from: string | undefined, to: string | undefined, fallback: DefaultRange, today: Date) {
  const presets = quickRanges(today)
  const def = presets.find((p) => p.key === fallback)!
  let f = isYmd(from) ? from : undefined
  let t = isYmd(to) ? to : undefined
  if (!f && !t) return { from: def.from, to: def.to, isDefault: true }
  f ??= t!
  t ??= ymd(today) < f ? f : ymd(today)
  if (f > t) [f, t] = [t, f]
  return { from: f, to: t, isDefault: false }
}

/** Start/end instants of a local-date range (inclusive end of day) for DATETIME columns. */
export function rangeInstants(from: string, to: string) {
  return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59.999`) }
}

/** Whole days between two yyyy-mm-dd dates (b − a). */
export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number)
  const [by, bm, bd] = b.split("-").map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** Every period key (yyyy-mm-dd or yyyy-mm) in a range — to draw continuous charts with zero days. */
export function periodKeys(from: string, to: string, period: "day" | "month", max = 400): string[] {
  const out: string[] = []
  if (period === "month") {
    let y = Number(from.slice(0, 4))
    let m = Number(from.slice(5, 7))
    const end = to.slice(0, 7)
    while (out.length < max) {
      const k = `${y}-${pad(m)}`
      if (k > end) break
      out.push(k)
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
    return out
  }
  const [y, m, d] = from.split("-").map(Number)
  let cur = new Date(y, m - 1, d)
  while (out.length < max) {
    const k = ymd(cur)
    if (k > to) break
    out.push(k)
    cur = addDays(cur, 1)
  }
  return out
}

/** Group a range by day when short, by month when long (used for "auto" period views). */
export function autoPeriod(from: string, to: string): "day" | "month" {
  return daysBetween(from, to) > 62 ? "month" : "day"
}

/** Human label for a range: "01 Oct 2026 – 31 Oct 2026" or a single day. */
export function rangeLabel(from: string, to: string) {
  const f = displayDate(from)
  return from === to ? f : `${f} – ${displayDate(to)}`
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** yyyy-mm-dd → dd MMM yyyy; yyyy-mm → MMM yyyy (period keys produced by SQL). */
export function displayDate(v: string) {
  if (/^\d{4}-\d{2}$/.test(v)) return `${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`
  if (!YMD.test(v.slice(0, 10))) return v
  return `${v.slice(8, 10)} ${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`
}

// ───────────── Aging ─────────────

export const AGING_BUCKETS = [
  { key: "b0_30", label: "0–30 days", min: 0, max: 30 },
  { key: "b31_60", label: "31–60 days", min: 31, max: 60 },
  { key: "b61_90", label: "61–90 days", min: 61, max: 90 },
  { key: "b90", label: "90+ days", min: 91, max: Infinity },
] as const

export type AgingKey = (typeof AGING_BUCKETS)[number]["key"]

/** Aging bucket for an invoice that is `days` old (future-dated invoices count as current). */
export function agingBucket(days: number): AgingKey {
  const d = Math.max(0, Math.floor(days))
  return AGING_BUCKETS.find((b) => d >= b.min && d <= b.max)!.key
}

/** Spread dues into aging buckets. */
export function ageDues(items: { invoiceDate: string; due: number | string }[], asOf: string) {
  const out: Record<AgingKey, Decimal> = { b0_30: new Decimal(0), b31_60: new Decimal(0), b61_90: new Decimal(0), b90: new Decimal(0) }
  for (const it of items) {
    const k = agingBucket(daysBetween(it.invoiceDate, asOf))
    out[k] = out[k].plus(it.due)
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.toDecimalPlaces(2).toNumber()])) as Record<AgingKey, number>
}

// ───────────── Numbers & totals ─────────────

export const NUMERIC_TYPES: ColumnType[] = ["money", "qty", "int", "percent"]
export const isNumericType = (t: ColumnType | undefined) => !!t && NUMERIC_TYPES.includes(t)

/** Exact decimal sum of a column (rows carry JS numbers converted from DB decimals). */
export function sumColumn(rows: ReportRow[], key: string, dp = 2) {
  let s = new Decimal(0)
  for (const r of rows) {
    const v = r[key]
    if (typeof v === "number" && Number.isFinite(v)) s = s.plus(v)
    else if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) s = s.plus(v)
  }
  return s.toDecimalPlaces(dp).toNumber()
}

/** Totals row for every column flagged `total`, labelled in the first text column. */
export function computeTotals(columns: ReportColumn[], rows: ReportRow[]): ReportRow | null {
  if (!columns.some((c) => c.total)) return null
  const out: ReportRow = {}
  for (const c of columns) {
    if (!c.total) continue
    const s = sumColumn(rows, c.key, c.type === "qty" ? 3 : 2)
    // shares of a whole: absorb per-row rounding (99.99 / 100.01 → 100)
    out[c.key] = c.type === "percent" && rows.length > 0 && Math.abs(s - 100) < 0.1 ? 100 : s
  }
  const first = columns.find((c) => !c.total && (c.type ?? "text") === "text")
  if (first) out[first.key] = "Total"
  return out
}

/** part / whole × 100, 2 dp; 0 when whole is 0. */
export function pct(part: number | string | Decimal, whole: number | string | Decimal) {
  const w = new Decimal(whole)
  if (w.isZero()) return 0
  return new Decimal(part).div(w).times(100).toDecimalPlaces(2).toNumber()
}

/** Keep the first `cap` rows; report how many matched. */
export function capRows<T>(rows: T[], cap: number): { rows: T[]; totalRows?: number } {
  return rows.length > cap ? { rows: rows.slice(0, cap), totalRows: rows.length } : { rows }
}

/** Remove cost/profit columns (and their totals) unless the viewer may see them. */
export function visibleColumns(columns: ReportColumn[], showCost: boolean) {
  return showCost ? columns : columns.filter((c) => !c.cost)
}

// ───────────── Excel ─────────────

/** Excel number format per column type. Percent values are stored as 12.5 (not 0.125). */
export function excelNumFmt(type: ColumnType | undefined): string | undefined {
  switch (type) {
    case "money":
      return "#,##0.00;[Red]-#,##0.00"
    case "qty":
      return "#,##0.###"
    case "int":
      return "#,##0"
    case "percent":
      return '0.00"%"'
    case "date":
      return "dd mmm yyyy"
    case "datetime":
      return "dd mmm yyyy hh:mm"
    default:
      return undefined
  }
}

/** Value written to an Excel cell: real numbers / dates so the sheet stays sortable and summable. */
export function excelValue(type: ColumnType | undefined, v: CellValue): string | number | Date | null {
  if (v == null || v === "") return null
  if (isNumericType(type)) {
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : String(v)
  }
  if ((type === "date" || type === "datetime") && typeof v === "string") {
    if (YMD.test(v)) {
      const [y, m, d] = v.split("-").map(Number)
      return new Date(Date.UTC(y, m - 1, d))
    }
    const dt = new Date(v)
    // Excel has no timezone: shift so the sheet shows local wall-clock time
    return Number.isNaN(dt.getTime()) ? v : new Date(dt.getTime() - dt.getTimezoneOffset() * 60_000)
  }
  return typeof v === "number" ? v : String(v)
}

/** Column width (characters) from the header and the longest rendered value, clamped. */
export function excelColumnWidth(col: ReportColumn, rows: ReportRow[], sample = 500) {
  let longest = col.label.length
  const n = Math.min(rows.length, sample)
  for (let i = 0; i < n; i++) {
    const v = rows[i][col.key]
    if (v == null) continue
    let len: number
    if (typeof v === "number") len = col.type === "money" ? Math.abs(v).toFixed(2).length + Math.floor(Math.log10(Math.max(1, Math.abs(v))) / 3) + 1 : String(v).length
    else if (col.type === "date") len = 11
    else if (col.type === "datetime") len = 17
    else len = String(v).length
    if (len > longest) longest = len
  }
  return Math.min(50, Math.max(col.type === "text" || !col.type ? 10 : 12, longest + 2))
}

/** Safe file name: "sales-report_2026-10-01_2026-10-31.xlsx" */
export function exportFileName(slug: string, from?: string | null, to?: string | null, ext = "xlsx") {
  const parts = [slug]
  if (from) parts.push(from)
  if (to && to !== from) parts.push(to)
  return `${parts.join("_").replace(/[^a-zA-Z0-9_-]/g, "-")}.${ext}`
}
