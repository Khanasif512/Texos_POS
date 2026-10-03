import { amount, date, dateTime, integer, quantity } from "@/lib/format"
import type { CellValue, ColumnType, ReportColumn } from "@/server/modules/reports/types"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Display string for a report cell (shared by the viewer table and the printable page). */
export function formatCell(type: ColumnType | undefined, v: CellValue): string {
  if (v == null || v === "") return type && type !== "text" ? "—" : ""
  switch (type) {
    case "money":
      return amount(v)
    case "qty":
      return quantity(v)
    case "int":
      return integer(v)
    case "percent":
      return `${Number(v).toFixed(2)}%`
    case "date":
    case "datetime": {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)} ${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`
      // labels such as "Total" in a date column pass through
      if (Number.isNaN(new Date(String(v)).getTime())) return String(v)
      return type === "date" ? date(String(v)) : dateTime(String(v))
    }
    default:
      return String(v)
  }
}

export const isNumeric = (t: ColumnType | undefined) => t === "money" || t === "qty" || t === "int" || t === "percent"

export const alignOf = (c: ReportColumn) => c.align ?? (isNumeric(c.type) ? "right" : "left")

/** Tone class for signed / negative-is-bad numeric cells. */
export function toneClass(c: ReportColumn, v: CellValue) {
  if (typeof v !== "number" || !c.tone) return ""
  if (c.tone === "signed") return v < 0 ? "text-destructive" : v > 0 ? "text-success" : ""
  return v > 0 ? "text-destructive" : ""
}
