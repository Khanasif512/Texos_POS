"use client"

import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { quantity } from "@/lib/format"

export type LowStockRow = {
  key: string
  variationId: string
  productName: string
  name: string
  sku: string
  unit: string
  branchName: string
  quantity: number
  reorderLevel: number
  shortfall: number
  out: boolean
}

export function LowStockTable({ rows, total, page, limit }: { rows: LowStockRow[]; total: number; page: number; limit: number }) {
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.key}
      onRowHref={(r) => `/app/inventory/${r.variationId}`}
      searchPlaceholder="Search product or SKU…"
      filters={<BranchFilter />}
      empty={
        <div className="flex flex-col items-center gap-3 py-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-success/12 text-success">
            <CheckCircle2 className="size-5" />
          </span>
          <p>Every item is above its reorder level. Set reorder levels on product variations to get alerts.</p>
        </div>
      }
      columns={[
        {
          key: "product",
          header: "Product",
          cell: (r) => (
            <div className="min-w-[200px]">
              <Link href={`/app/inventory/${r.variationId}`} className="font-medium hover:underline">
                {r.productName}
              </Link>
              <p className="text-xs text-muted-foreground">
                {r.name} · <span className="num">{r.sku}</span>
              </p>
            </div>
          ),
        },
        { key: "branch", header: "Branch", cell: (r) => r.branchName },
        {
          key: "qty",
          header: "On hand",
          align: "right",
          cell: (r) => (
            <span className={r.out ? "num font-medium text-destructive" : "num font-medium text-warning"}>
              {quantity(r.quantity)} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span>
            </span>
          ),
        },
        { key: "reorder", header: "Reorder level", align: "right", cell: (r) => <span className="num text-muted-foreground">{quantity(r.reorderLevel)}</span> },
        { key: "short", header: "Shortfall", align: "right", cell: (r) => <span className="num">{quantity(r.shortfall)}</span> },
        { key: "status", header: "Status", cell: (r) => (r.out ? <StatusBadge tone="danger">Out of stock</StatusBadge> : <StatusBadge tone="warning">Low</StatusBadge>) },
      ]}
    />
  )
}
