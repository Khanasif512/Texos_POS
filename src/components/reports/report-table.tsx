"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { ReportRow, ReportTable } from "@/server/modules/reports/types"
import { alignOf, formatCell, isNumeric, toneClass } from "./format-cell"

const PAGE = 100

/** Dense report table: client-side sort and pagination over the (capped) rows, totals footer over everything. */
export function ReportTableView({ table }: { table: ReportTable }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    if (!sort) return table.rows
    const col = table.columns.find((c) => c.key === sort.key)
    const numeric = isNumeric(col?.type)
    return [...table.rows].sort((a, b) => {
      const x = a[sort.key]
      const y = b[sort.key]
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (numeric ? Number(x) - Number(y) : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir
    })
  }, [table.rows, table.columns, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * PAGE, current * PAGE)
  const totals = table.totals
  const labelled = !!totals && Object.values(totals).some((v) => typeof v === "string")

  const toggle = (key: string) => {
    setPage(1)
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null))
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      {table.title && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{table.title}</h2>
          <span className="text-xs text-muted-foreground">{table.rows.length === 1 ? "1 row" : `${table.rows.length} rows`}</span>
        </div>
      )}
      <Table className="text-[13px]">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {table.columns.map((c) => (
              <TableHead key={c.key} className={cn("h-9 text-xs font-medium whitespace-nowrap", alignOf(c) === "right" && "text-right")}>
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cn("inline-flex items-center gap-1 hover:text-foreground", alignOf(c) === "right" && "flex-row-reverse")}
                >
                  {c.label}
                  {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={table.columns.length} className="h-28 text-center text-sm text-muted-foreground">
                {table.empty || "No data for these filters."}
              </TableCell>
            </TableRow>
          ) : (
            visible.map((r, i) => <Row key={i} row={r} table={table} />)
          )}
        </TableBody>
        {totals && visible.length > 0 && (
          <TableFooter>
            <TableRow className="hover:bg-muted/50">
              {table.columns.map((c, i) => {
                const v = totals[c.key]
                return (
                  <TableCell key={c.key} className={cn("py-2.5 font-semibold whitespace-nowrap", alignOf(c) === "right" && "num text-right", toneClass(c, v ?? null))}>
                    {v == null ? (i === 0 && !labelled ? "Total" : "") : formatCell(c.type, v)}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableFooter>
        )}
      </Table>
      {(pages > 1 || table.totalRows) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {table.totalRows ? (
              <>
                <Info className="size-3.5" /> Showing the first {table.rows.length.toLocaleString("en-IN")} of {table.totalRows.toLocaleString("en-IN")} rows — totals
                cover all rows. Narrow the filters to see the rest.
              </>
            ) : (
              `${(current - 1) * PAGE + 1}–${Math.min(rows.length, current * PAGE)} of ${rows.length}`
            )}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <span className="mr-1">
                Page {current} of {pages}
              </span>
              <Button variant="outline" size="icon-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Row({ row, table }: { row: ReportRow; table: ReportTable }) {
  return (
    <TableRow>
      {table.columns.map((c) => {
        const v = row[c.key]
        const right = alignOf(c) === "right"
        return (
          <TableCell
            key={c.key}
            className={cn("py-2 whitespace-nowrap", right && "num text-right", c.type === "text" || !c.type ? "max-w-[280px] truncate" : "", toneClass(c, v ?? null))}
            title={!c.type || c.type === "text" ? String(v ?? "") : undefined}
          >
            {formatCell(c.type, v ?? null)}
          </TableCell>
        )
      })}
    </TableRow>
  )
}
