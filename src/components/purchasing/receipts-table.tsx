"use client"

import Link from "next/link"
import { PackageCheck, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { useCan } from "@/components/app/app-context"
import { date, money, quantity } from "@/lib/format"

export type GoodsReceiptRow = {
  id: string
  number: string
  date: string
  branchName: string
  source: "lc" | "po"
  sourceNumber: string
  sourceId: string | null
  supplierName: string
  quantity: number
  value: number | null
}

export function ReceiptsTable({
  rows,
  total,
  page,
  limit,
  filtered,
  showCost,
}: {
  rows: GoodsReceiptRow[]
  total: number
  page: number
  limit: number
  filtered: boolean
  showCost: boolean
}) {
  const canReceive = useCan("purchase.receive")
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/purchases/receipts/${r.id}`}
      searchPlaceholder="Search GRN, PO, LC or supplier…"
      filters={
        <>
          <SelectFilter
            name="source"
            placeholder="All sources"
            options={[
              { value: "po", label: "Purchase orders" },
              { value: "lc", label: "LC imports" },
            ]}
          />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        canReceive && (
          <Button asChild>
            <Link href="/app/purchases/receipts/new">
              <Plus /> Receive goods
            </Link>
          </Button>
        )
      }
      empty={
        filtered ? (
          "No goods receipts match these filters."
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <PackageCheck className="size-5" />
            </span>
            <p>No goods received yet. Receive a purchase order or a landed LC to bring stock in.</p>
          </div>
        )
      }
      columns={[
        {
          key: "number",
          header: "GRN",
          sortKey: "number",
          cell: (r) => (
            <Link href={`/app/purchases/receipts/${r.id}`} className="num font-medium whitespace-nowrap hover:underline">
              {r.number}
            </Link>
          ),
        },
        { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
        {
          key: "source",
          header: "Against",
          cell: (r) => (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <StatusBadge tone={r.source === "lc" ? "primary" : "info"}>{r.source === "lc" ? "LC" : "PO"}</StatusBadge>
              {r.sourceId ? (
                <Link href={r.source === "lc" ? `/app/lc/${r.sourceId}` : `/app/purchases/${r.sourceId}`} className="num text-sm hover:underline">
                  {r.sourceNumber}
                </Link>
              ) : (
                <span className="num text-sm">{r.sourceNumber}</span>
              )}
            </div>
          ),
        },
        { key: "supplier", header: "Supplier", cell: (r) => r.supplierName },
        { key: "branch", header: "Branch", cell: (r) => <span className="text-muted-foreground">{r.branchName}</span> },
        { key: "qty", header: "Quantity", align: "right", cell: (r) => <span className="num">{quantity(r.quantity)}</span> },
        ...(showCost
          ? [{ key: "value", header: "Value at cost", align: "right" as const, cell: (r: GoodsReceiptRow) => <span className="num font-medium">{money(r.value)}</span> }]
          : []),
      ]}
    />
  )
}
