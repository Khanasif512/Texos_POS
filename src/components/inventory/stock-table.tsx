"use client"

import Link from "next/link"
import { Boxes } from "lucide-react"
import { ServerTable, type ServerColumn } from "@/components/shared/server-table"
import { BranchFilter, SelectFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export type StockRow = {
  id: string
  productName: string
  name: string
  sku: string
  unit: string
  reorderLevel: number
  perBranch: Record<string, number>
  total: number
  lowIn: string[]
  value: number | null
}

export function StockTable({
  rows,
  total,
  page,
  limit,
  branches,
  showCost,
  filtered,
}: {
  rows: StockRow[]
  total: number
  page: number
  limit: number
  branches: { id: string; name: string; code: string }[]
  showCost: boolean
  filtered: boolean
}) {
  const single = branches.length === 1
  const columns: ServerColumn<StockRow>[] = [
    {
      key: "product",
      header: "Product",
      sortKey: "product",
      cell: (r) => (
        <div className="min-w-[200px]">
          <Link href={`/app/inventory/${r.id}`} className="font-medium hover:underline">
            {r.productName}
          </Link>
          <p className="text-xs text-muted-foreground">{r.name}</p>
        </div>
      ),
    },
    { key: "sku", header: "SKU", sortKey: "sku", cell: (r) => <span className="num text-xs text-muted-foreground">{r.sku}</span> },
    ...branches.map<ServerColumn<StockRow>>((b) => ({
      key: `b-${b.id}`,
      header: single ? "On hand" : <span title={b.name}>{b.code}</span>,
      align: "right",
      cell: (r) => {
        const q = r.perBranch[b.id] ?? 0
        const low = r.lowIn.includes(b.id)
        return (
          <span className={cn("num", q <= 0 && "text-muted-foreground", low && "font-medium text-destructive")} title={low ? `At or below reorder level (${quantity(r.reorderLevel)})` : undefined}>
            {quantity(q)}
          </span>
        )
      },
    })),
    ...(single
      ? []
      : [
          {
            key: "total",
            header: "Total",
            align: "right" as const,
            cell: (r: StockRow) => (
              <span className="num font-semibold">
                {quantity(r.total)} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span>
              </span>
            ),
          },
        ]),
    {
      key: "reorder",
      header: "Reorder at",
      sortKey: "reorderLevel",
      align: "right",
      cell: (r) =>
        r.reorderLevel > 0 ? (
          <div className="flex items-center justify-end gap-2">
            {r.lowIn.length > 0 && <StatusBadge tone="danger">Low</StatusBadge>}
            <span className="num text-muted-foreground">{quantity(r.reorderLevel)}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    ...(showCost
      ? [{ key: "value", header: "Value at cost", align: "right" as const, cell: (r: StockRow) => <span className="num">{money(r.value)}</span> }]
      : []),
  ]
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/inventory/${r.id}`}
      searchPlaceholder="Search product, SKU or barcode…"
      filters={
        <>
          <BranchFilter />
          <SelectFilter
            name="stock"
            placeholder="All items"
            options={[
              { value: "in_stock", label: "In stock" },
              { value: "out_of_stock", label: "Out of stock" },
            ]}
          />
        </>
      }
      empty={
        filtered ? (
          "No items match these filters."
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <Boxes className="size-5" />
            </span>
            <p>No active products yet. Add products, then post opening stock or receive goods.</p>
          </div>
        )
      }
      columns={columns}
    />
  )
}
