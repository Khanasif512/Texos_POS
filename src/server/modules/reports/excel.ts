import "server-only"
import ExcelJS from "exceljs"
import type { LoadedReport } from "./service"
import type { ReportTable } from "./types"
import { excelColumnWidth, excelNumFmt, excelValue, isNumericType } from "./utils"

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } }
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }
const THIN = { style: "thin" as const, color: { argb: "FFD1D5DB" } }

/** Sheet names: max 31 chars, no []:*?/\ and unique. */
function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Report"
  let n = base
  for (let i = 2; used.has(n); i++) n = `${base.slice(0, 28)} ${i}`
  used.add(n)
  return n
}

function writeTable(ws: ExcelJS.Worksheet, table: ReportTable, startRow: number) {
  const cols = table.columns
  const header = ws.getRow(startRow)
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.label
    cell.font = { bold: true }
    cell.fill = HEADER_FILL
    cell.border = { bottom: THIN }
    cell.alignment = { horizontal: isNumericType(c.type) ? "right" : "left", vertical: "middle" }
  })
  let rowNo = startRow + 1
  for (const r of table.rows) {
    const row = ws.getRow(rowNo++)
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = excelValue(c.type, r[c.key] ?? null)
      const fmt = excelNumFmt(c.type)
      if (fmt) cell.numFmt = fmt
    })
  }
  if (table.totals) {
    const labelled = Object.values(table.totals).some((v) => typeof v === "string")
    const row = ws.getRow(rowNo++)
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      const v = table.totals![c.key]
      cell.value = v == null ? (i === 0 && !labelled ? "Total" : null) : excelValue(c.type, v)
      const fmt = excelNumFmt(c.type)
      if (fmt) cell.numFmt = fmt
      cell.font = { bold: true }
      cell.fill = TOTAL_FILL
      cell.border = { top: THIN }
    })
  }
  if (table.totalRows) {
    ws.getRow(rowNo++).getCell(1).value = `Showing the first ${table.rows.length} of ${table.totalRows} rows; totals cover all rows.`
  }
  return rowNo
}

/**
 * Excel workbook: one sheet per table, each with company / report / filter header rows,
 * bold header, typed number formats, totals row, sized columns and a frozen header.
 */
export async function reportWorkbook(rep: LoadedReport, companyName: string, userName: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = "TexonPOS"
  wb.created = new Date()
  const used = new Set<string>()
  const tables = rep.result.tables.length ? rep.result.tables : [{ key: "empty", columns: [{ key: "x", label: "" }], rows: [] } as ReportTable]

  for (const table of tables) {
    const ws = wb.addWorksheet(sheetName(table.title ?? rep.def.title, used), {
      pageSetup: { orientation: rep.def.landscape ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    })
    const span = Math.max(1, table.columns.length)
    const head: [string, Partial<ExcelJS.Font>][] = [
      [companyName, { bold: true, size: 14 }],
      [table.title && table.title !== rep.def.title ? `${rep.def.title} — ${table.title}` : rep.def.title, { bold: true, size: 12 }],
      [rep.description.join("  ·  "), { size: 10, color: { argb: "FF6B7280" } }],
      [`Generated ${new Date().toLocaleString("en-GB")} by ${userName}`, { size: 9, color: { argb: "FF9CA3AF" } }],
    ]
    head.forEach(([text, font], i) => {
      if (span > 1) ws.mergeCells(i + 1, 1, i + 1, span)
      const cell = ws.getCell(i + 1, 1)
      cell.value = text
      cell.font = font
    })
    let next = head.length + 2
    if (rep.result.summary?.length && table === tables[0]) {
      for (const s of rep.result.summary) {
        const row = ws.getRow(next++)
        row.getCell(1).value = s.label
        row.getCell(1).font = { color: { argb: "FF6B7280" } }
        const v = row.getCell(2)
        v.value = typeof s.value === "number" ? excelValue(s.type, s.value) : s.value
        const fmt = excelNumFmt(s.type)
        if (fmt && typeof s.value === "number") v.numFmt = fmt
        v.font = { bold: true }
        if (s.hint) row.getCell(3).value = s.hint
      }
      next++
    }
    const headerRow = next
    writeTable(ws, table, headerRow)
    ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 0 }]
    table.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = excelColumnWidth(c, table.rows)
    })
    if (table.rows.length) ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: span } }
  }
  if (rep.result.notes?.length) {
    const ws = wb.worksheets[0]
    let row = ws.rowCount + 2
    for (const n of rep.result.notes) ws.getRow(row++).getCell(1).value = n
  }
  return wb.xlsx.writeBuffer()
}
