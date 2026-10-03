"use client"

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type ServerColumn<T> = {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  /** DB field name to sort by (must be in the page's `sortable` list) */
  sortKey?: string
  align?: "left" | "right" | "center"
  className?: string
}

/** Hook that patches the URL query (resetting page) — for filters next to a ServerTable. */
export function useQueryState() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [pending, start] = useTransition()
  const set = (patch: Record<string, string | null | undefined>, resetPage = true) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === "all") next.delete(k)
      else next.set(k, v)
    }
    if (resetPage) next.delete("page")
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }
  return { sp, set, pending }
}

/**
 * URL-driven table (search, sort, pagination done on the server — NFR-UX-04, NFR-PERF).
 * The page reads `searchParams` with readListParams() and passes rows + total.
 */
export function ServerTable<T>({
  rows,
  total,
  page,
  limit,
  columns,
  rowKey,
  searchPlaceholder = "Search…",
  filters,
  actions,
  empty,
  onRowHref,
}: {
  rows: T[]
  total: number
  page: number
  limit: number
  columns: ServerColumn<T>[]
  rowKey: (r: T) => string
  searchPlaceholder?: string
  filters?: React.ReactNode
  actions?: React.ReactNode
  empty?: React.ReactNode
  onRowHref?: (r: T) => string
}) {
  const router = useRouter()
  const { sp, set, pending } = useQueryState()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const sort = sp.get("sort") ?? ""
  const [sortField, sortDir] = sort.split(":")
  const pages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => {
    const current = sp.get("q") ?? ""
    if (q === current) return
    const t = setTimeout(() => set({ q }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-8" />
          {pending && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        {actions && <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{actions}</div>}
      </div>
      <div className={cn("overflow-x-auto transition-opacity", pending && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((c) => (
                <TableHead key={c.key} className={cn("h-10 text-xs font-medium whitespace-nowrap", c.align === "right" && "text-right", c.className)}>
                  {c.sortKey ? (
                    <button
                      className={cn("inline-flex items-center gap-1 hover:text-foreground", c.align === "right" && "flex-row-reverse")}
                      onClick={() => set({ sort: `${c.sortKey}:${sortField === c.sortKey && sortDir === "asc" ? "desc" : "asc"}` }, false)}
                    >
                      {c.header}
                      {sortField === c.sortKey && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-40 text-center text-sm text-muted-foreground">
                  {sp.get("q") ? "No results match your search." : (empty ?? "Nothing here yet.")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={rowKey(r)}
                  className={cn(onRowHref && "cursor-pointer")}
                  onClick={onRowHref ? (e) => !(e.target as HTMLElement).closest("button,a,input") && router.push(onRowHref(r)) : undefined}
                >
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
      <div className="flex items-center justify-between border-t px-3 py-2.5 text-xs text-muted-foreground">
        <span>{total === 0 ? "0 results" : `${(page - 1) * limit + 1}–${Math.min(total, page * limit)} of ${total}`}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} aria-label="Next page">
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
