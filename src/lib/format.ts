import { format as fmtDate } from "date-fns"

type Num = number | string | { toString(): string } | null | undefined

const toNum = (v: Num) => (v == null ? 0 : typeof v === "number" ? v : Number(v.toString()))

/** Bangladesh grouping (1,23,456.00) — NFR-UX-03. */
const bdt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 })
const int = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

export const money = (v: Num, symbol = "৳") => `${symbol}\u00a0${bdt.format(toNum(v))}`
export const amount = (v: Num) => bdt.format(toNum(v))
export const quantity = (v: Num) => qty.format(toNum(v))
export const integer = (v: Num) => int.format(toNum(v))
export const compactMoney = (v: Num) => {
  const n = toNum(v)
  if (Math.abs(n) >= 10_000_000) return `৳${(n / 10_000_000).toFixed(2)} Cr`
  if (Math.abs(n) >= 100_000) return `৳${(n / 100_000).toFixed(2)} L`
  return money(n)
}

export const date = (d: Date | string | null | undefined) => (d ? fmtDate(new Date(d), "dd MMM yyyy") : "—")
export const dateTime = (d: Date | string | null | undefined) => (d ? fmtDate(new Date(d), "dd MMM yyyy, h:mm a") : "—")

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
