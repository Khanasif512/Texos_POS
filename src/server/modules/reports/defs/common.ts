import "server-only"
import { ownSalesSql, type RunCtx } from "../framework"
import { empty, inList, raw, sql, type Sql } from "../sql"
import type { FilterOption, FilterSpec, ReportRow } from "../types"
import { periodKeys } from "../utils"

/** Invoices that count as sales: confirmed (incl. partially/fully returned), never draft or cancelled. */
export const SOLD = raw(`('confirmed','partially_returned','returned')`)

/** WHERE body for sales invoices in range + branch scope + own-sales restriction. */
export function invoiceScope(r: RunCtx, a = "i"): Sql {
  const t = (c: string) => raw(`${a}.${c}`)
  const salesman = r.value("salesmanId")
  return sql`${t("companyId")} = ${r.companyId} AND ${t("status")} IN ${SOLD}
    AND ${t("branchId")} IN (${inList(r.branchIds)})
    AND ${t("invoiceDate")} BETWEEN ${r.start} AND ${r.end}
    ${salesman ? sql`AND ${t("salesmanId")} = ${salesman}` : empty}
    ${ownSalesSql(r, a)}`
}

/**
 * Approved returns attributed to the period they were approved in (P&L, sales summaries).
 * Requires `sales_returns sr JOIN invoices i ON i.id = sr.invoiceId`.
 */
export function approvedReturnScope(r: RunCtx): Sql {
  const salesman = r.value("salesmanId")
  return sql`sr.companyId = ${r.companyId} AND sr.status = 'approved'
    AND sr.branchId IN (${inList(r.branchIds)})
    AND COALESCE(sr.approvedAt, sr.date) BETWEEN ${r.start} AND ${r.end}
    ${salesman ? sql`AND i.salesmanId = ${salesman}` : empty}
    ${ownSalesSql(r, "i")}`
}

/** Expenses (DATE column) in range + branch scope. */
export function expenseScope(r: RunCtx, a = "e"): Sql {
  const t = (c: string) => raw(`${a}.${c}`)
  return sql`${t("companyId")} = ${r.companyId} AND ${t("branchId")} IN (${inList(r.branchIds)}) AND ${t("date")} BETWEEN ${r.from} AND ${r.to}`
}

export const PERIOD_OPTIONS: FilterOption[] = [
  { value: "day", label: "By day" },
  { value: "month", label: "By month" },
]

export const salesmanFilter: FilterSpec = { key: "salesmanId", label: "Salesman", kind: "select", options: "salesmen", allLabel: "All salesmen" }
export const categoryFilter: FilterSpec = { key: "categoryId", label: "Category", kind: "select", options: "categories", allLabel: "All categories" }

/** Fill missing period keys with zero rows so charts read as continuous time. */
export function fillPeriods(rows: Map<string, ReportRow>, from: string, to: string, period: "day" | "month", zero: () => ReportRow) {
  const keys = periodKeys(from, to, period)
  if (keys.length >= 400) return [...rows.values()].sort((a, b) => String(a.period).localeCompare(String(b.period)))
  return keys.map((k) => rows.get(k) ?? { period: k, ...zero() })
}

export const humanize = (v: string | null | undefined) => (v ? v.charAt(0).toUpperCase() + v.slice(1).replaceAll("_", " ") : "—")

export const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  mobile_banking: "Mobile banking",
  card: "Card",
  cheque: "Cheque",
}

/** Product label used across item reports. */
export const PRODUCT_COLUMNS = sql`v.sku AS sku, p.name AS product, v.name AS variation, p.unit AS unit`
export const PRODUCT_JOIN = sql`JOIN product_variations v ON v.id = il.variationId JOIN products p ON p.id = v.productId`
