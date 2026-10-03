"use client"

import Link from "next/link"
import { Link2, Plus, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { useCan } from "@/components/app/app-context"
import { date, money } from "@/lib/format"
import { PO_STATUSES } from "@/lib/validation/purchasing"
import { PoStatusBadge } from "./status"

export type PurchaseOrderRow = {
  id: string
  number: string
  supplierName: string
  branchName: string
  orderDate: string
  expectedDate: string | null
  currency: string
  totalBdt: number | null
  status: string
  lineCount: number
  progress: number
  lcLinked: boolean
}

export function PurchaseOrdersTable({
  rows,
  total,
  page,
  limit,
  filtered,
  showCost,
}: {
  rows: PurchaseOrderRow[]
  total: number
  page: number
  limit: number
  filtered: boolean
  showCost: boolean
}) {
  const canCreate = useCan("purchase.create")
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/purchases/${r.id}`}
      searchPlaceholder="Search PO number or supplier…"
      filters={
        <>
          <SelectFilter name="status" placeholder="All statuses" options={[{ value: "open", label: "Open (to receive)" }, ...PO_STATUSES]} />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        canCreate && (
          <Button asChild>
            <Link href="/app/purchases/new">
              <Plus /> New purchase order
            </Link>
          </Button>
        )
      }
      empty={
        filtered ? (
          "No purchase orders match these filters."
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <ShoppingCart className="size-5" />
            </span>
            <p>No purchase orders yet. Record local purchases from your suppliers here.</p>
            {canCreate && (
              <Button size="sm" asChild>
                <Link href="/app/purchases/new">
                  <Plus /> Create your first PO
                </Link>
              </Button>
            )}
          </div>
        )
      }
      columns={[
        {
          key: "number",
          header: "PO number",
          sortKey: "number",
          cell: (r) => (
            <div className="min-w-[140px]">
              <Link href={`/app/purchases/${r.id}`} className="num font-medium hover:underline">
                {r.number}
              </Link>
              {r.lcLinked && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="size-3" /> LC linked
                </p>
              )}
            </div>
          ),
        },
        { key: "orderDate", header: "Order date", sortKey: "orderDate", cell: (r) => <span className="whitespace-nowrap">{date(r.orderDate)}</span> },
        { key: "supplier", header: "Supplier", cell: (r) => <span className="font-medium">{r.supplierName}</span> },
        { key: "branch", header: "Branch", cell: (r) => <span className="text-muted-foreground">{r.branchName}</span> },
        {
          key: "expected",
          header: "Expected",
          cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{r.expectedDate ? date(r.expectedDate) : "—"}</span>,
        },
        ...(showCost
          ? [
              {
                key: "total",
                header: "Total",
                sortKey: "totalBdt",
                align: "right" as const,
                cell: (r: PurchaseOrderRow) => <span className="num font-medium">{money(r.totalBdt)}</span>,
              },
            ]
          : []),
        {
          key: "received",
          header: "Received",
          cell: (r) => (
            <div className="flex min-w-[100px] items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${r.progress}%` }} />
              </div>
              <span className="num text-xs text-muted-foreground">{r.progress}%</span>
            </div>
          ),
        },
        { key: "status", header: "Status", cell: (r) => <PoStatusBadge status={r.status} /> },
      ]}
    />
  )
}
