"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type Column<T> = {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** value used for sorting and search */
  value?: (row: T) => string | number | null | undefined
  className?: string
  align?: "left" | "right" | "center"
}

/** Client-side table with search, sort and pagination (NFR-UX-04) for small/medium lists. */
export function DataTable<T>({
  rows,
  columns,
  searchPlaceholder = "Search…",
  toolbar,
  pageSize = 15,
  empty,
  rowKey,
  onRowClick,
}: {
  rows: T[]
  columns: Column<T>[]
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  pageSize?: number
  empty?: React.ReactNode
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
}) {
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    let out = term
      ? rows.filter((r) => columns.some((c) => String(c.value?.(r) ?? "").toLowerCase().includes(term)))
      : rows
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col?.value)
        out = [...out].sort((a, b) => {
          const av = col.value!(a) ?? ""
          const bv = col.value!(b) ?? ""
          return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir
        })
    }
    return out
  }, [rows, columns, q, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize)

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder={searchPlaceholder}
            className="h-9 pl-8"
          />
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div>}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn("h-10 text-xs font-medium whitespace-nowrap", c.align === "right" && "text-right", c.className)}
                >
                  {c.value ? (
                    <button
                      className={cn("inline-flex items-center gap-1 hover:text-foreground", c.align === "right" && "flex-row-reverse")}
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                    >
                      {c.header}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-40 text-center text-sm text-muted-foreground">
                  {q ? "No results match your search." : (empty ?? "Nothing here yet.")}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn(onRowClick && "cursor-pointer")}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={cn("py-3", c.align === "right" && "text-right", c.className)}>
                      {c.cell(r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between border-t px-3 py-2.5 text-xs text-muted-foreground">
          <span>
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
