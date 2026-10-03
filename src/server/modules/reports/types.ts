/**
 * Report framework types (RPT, SRS §4.13). Type-only module: safe to `import type` from client components.
 * A report is a definition (see ./registry.ts) whose `run` returns a ReportResult — one or more tables plus
 * optional summary cards and a chart. The viewer, the Excel export and the printable page all render it.
 */

export type ColumnType = "text" | "money" | "qty" | "int" | "date" | "datetime" | "percent"

export type ReportColumn = {
  key: string
  label: string
  type?: ColumnType
  align?: "left" | "right" | "center"
  /** include in the totals row (numeric columns) */
  total?: boolean
  /** cost / profit column — hidden unless the user may see cost prices or the report is financial */
  cost?: boolean
  /** signed: red below zero, green above; positive-bad: red when above zero (dues, payables) */
  tone?: "signed" | "positive-bad"
}

export type CellValue = string | number | null
export type ReportRow = Record<string, CellValue>

export type ReportTable = {
  key: string
  title?: string
  columns: ReportColumn[]
  rows: ReportRow[]
  /** explicit totals (when rows are truncated the report must aggregate in SQL); otherwise summed from rows */
  totals?: ReportRow | null
  /** total rows matched when `rows` was capped */
  totalRows?: number
  empty?: string
}

export type SummaryItem = {
  label: string
  value: number | string
  type?: ColumnType
  hint?: string
  tone?: "default" | "success" | "danger" | "warning"
  cost?: boolean
}

export type ReportChart = {
  kind: "bar" | "line" | "area" | "hbar"
  title?: string
  xKey: string
  series: { key: string; label: string; cost?: boolean }[]
  data: ReportRow[]
  valueType?: ColumnType
}

export type ReportResult = {
  summary?: SummaryItem[]
  chart?: ReportChart | null
  tables: ReportTable[]
  notes?: string[]
  /** shown instead of the tables when a required filter (e.g. customer) is missing */
  prompt?: { title: string; text: string }
}

export type FilterOption = { value: string; label: string }

/** Extra filters a report declares besides date range and branch. */
export type FilterSpec =
  | {
      key: string
      label: string
      kind: "select"
      /** static options, or a named option source resolved on the server */
      options: FilterOption[] | "salesmen" | "categories"
      /** value used when the URL has none; omit for "all" */
      default?: string
      allLabel?: string
    }
  | { key: string; label: string; kind: "segment"; options: FilterOption[]; default: string }
  | { key: string; label: string; kind: "customer" | "supplier" | "lc"; required?: boolean }

export type DateMode = "range" | "asOf" | "none"
export type DefaultRange = "today" | "this_month" | "this_year"

/** Serializable filter state handed to the client filter bar. */
export type ResolvedFilter =
  | { key: string; label: string; kind: "select"; options: FilterOption[]; value: string | null; allLabel: string; hasDefault: boolean }
  | { key: string; label: string; kind: "segment"; options: FilterOption[]; value: string }
  | { key: string; label: string; kind: "customer" | "supplier" | "lc"; value: { id: string; label: string } | null; required: boolean }

export type QuickRange = { key: string; label: string; from: string; to: string }
