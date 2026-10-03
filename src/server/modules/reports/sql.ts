import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"

/**
 * Raw-SQL helpers for reports (NFR-PERF-02: aggregate in MySQL, never N+1).
 * Every query MUST filter `companyId = ${companyId}` explicitly — the tenant extension does not apply to $queryRaw.
 * Column names passed to the helpers below are code constants, never user input.
 */

/** Max detail rows a report table returns; totals are always aggregated over everything. */
export const ROW_CAP = 5000

/** Minutes east of UTC for the server's (company's) timezone — DATETIME columns are stored in UTC. */
function tzOffset() {
  return Math.trunc(-new Date().getTimezoneOffset())
}

const COLUMN = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/
function col(name: string) {
  if (!COLUMN.test(name)) throw new Error(`Invalid column reference: ${name}`)
  return name
}

/** Local calendar day (yyyy-mm-dd) of a DATETIME column. */
export const dayOf = (c: string) => Prisma.raw(`DATE_FORMAT(DATE_ADD(${col(c)}, INTERVAL ${tzOffset()} MINUTE), '%Y-%m-%d')`)
/** Local month (yyyy-mm) of a DATETIME column. */
export const monthOf = (c: string) => Prisma.raw(`DATE_FORMAT(DATE_ADD(${col(c)}, INTERVAL ${tzOffset()} MINUTE), '%Y-%m')`)
/** Period key of a DATETIME column. */
export const periodOf = (c: string, p: "day" | "month") => (p === "day" ? dayOf(c) : monthOf(c))
/** Period key of a sales return: the approval instant, falling back to the return date. Needs alias `sr`. */
export const returnPeriodOf = (p: "day" | "month") =>
  Prisma.raw(`DATE_FORMAT(DATE_ADD(COALESCE(sr.approvedAt, sr.date), INTERVAL ${tzOffset()} MINUTE), '${p === "day" ? "%Y-%m-%d" : "%Y-%m"}')`)
/** Period key of a DATE column (no timezone shift). */
export const datePeriodOf = (c: string, p: "day" | "month") => Prisma.raw(`DATE_FORMAT(${col(c)}, '${p === "day" ? "%Y-%m-%d" : "%Y-%m"}')`)

/** IN-list that is never empty (an empty scope matches nothing). */
export const inList = (ids: string[]) => Prisma.join(ids.length ? ids : ["__none__"])

export const sql = Prisma.sql
export const empty = Prisma.empty
export const raw = Prisma.raw
export type Sql = Prisma.Sql

export function query<T>(q: Prisma.Sql) {
  return prisma.$queryRaw<T[]>(q)
}

/** DB value → JS number for display/export (bigint COUNTs, Decimal SUMs, strings, null). */
export function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  if (typeof v === "bigint") return Number(v)
  const n = Number(String(v))
  return Number.isFinite(n) ? n : 0
}

/** DB date/datetime → ISO string (client components receive plain strings). */
export function toIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

/** DATE column value (stored as UTC midnight) → yyyy-mm-dd. */
export function toYmd(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}
