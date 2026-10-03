"use client"

import Link from "next/link"
import { Boxes, FolderTree, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, SelectFilter } from "@/components/shared/filters"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { useCan } from "@/components/app/app-context"
import { money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ProductRow = {
  id: string
  name: string
  brand: string | null
  unit: string
  imageUrl: string | null
  category: string | null
  status: string
  variations: number
  priceMin: number | null
  priceMax: number | null
  stock: number
  lowStock: number
}

export function ProductsTable({
  rows,
  total,
  page,
  limit,
  categories,
  filtered,
}: {
  rows: ProductRow[]
  total: number
  page: number
  limit: number
  categories: { id: string; name: string }[]
  filtered: boolean
}) {
  const canCreate = useCan("inventory.create")
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/products/${r.id}`}
      searchPlaceholder="Search product, SKU or barcode…"
      filters={
        <>
          <SelectFilter
            name="categoryId"
            placeholder="All categories"
            options={[...categories.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "Uncategorised" }]}
          />
          <SelectFilter
            name="status"
            placeholder="All statuses"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <BranchFilter />
        </>
      }
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href="/app/products/categories">
              <FolderTree /> Categories
            </Link>
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/app/products/new">
                <Plus /> New product
              </Link>
            </Button>
          )}
        </>
      }
      empty={
        filtered ? (
          "No products match these filters."
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <Boxes className="size-5" />
            </span>
            <p>No products yet. Add products with their variations, SKUs and prices.</p>
            {canCreate && (
              <Button size="sm" asChild>
                <Link href="/app/products/new">
                  <Plus /> Add your first product
                </Link>
              </Button>
            )}
          </div>
        )
      }
      columns={[
        {
          key: "name",
          header: "Product",
          sortKey: "name",
          cell: (r) => (
            <div className="flex min-w-[200px] items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <Boxes className="size-4" />
                )}
              </span>
              <div className="min-w-0">
                <Link href={`/app/products/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                {r.brand && <p className="text-xs text-muted-foreground">{r.brand}</p>}
              </div>
            </div>
          ),
        },
        { key: "category", header: "Category", cell: (r) => (r.category ? r.category : <span className="text-muted-foreground">—</span>) },
        {
          key: "variations",
          header: "Variations",
          align: "right",
          cell: (r) => <span className="num">{r.variations}</span>,
        },
        {
          key: "price",
          header: "Sale price",
          align: "right",
          cell: (r) =>
            r.priceMin == null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="num whitespace-nowrap">
                {money(r.priceMin)}
                {r.priceMax !== r.priceMin && <> – {money(r.priceMax)}</>}
              </span>
            ),
        },
        {
          key: "stock",
          header: "Stock",
          align: "right",
          cell: (r) => (
            <div className="whitespace-nowrap">
              <span className={cn("num", r.stock <= 0 && "text-muted-foreground")}>
                {quantity(r.stock)} <span className="text-xs text-muted-foreground">{r.unit}</span>
              </span>
              {r.lowStock > 0 && (
                <div>
                  <StatusBadge tone="warning">{r.lowStock} low</StatusBadge>
                </div>
              )}
            </div>
          ),
        },
        { key: "status", header: "Status", cell: (r) => <ActiveBadge status={r.status} /> },
      ]}
    />
  )
}
