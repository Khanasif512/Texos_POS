"use client"

import Link from "next/link"
import { ArrowRight, ArrowRightLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { TransferStatusBadge } from "@/components/purchasing/status"
import { date, money, quantity } from "@/lib/format"

export type TransferRow = {
  id: string
  number: string
  date: string
  fromName: string
  toName: string
  status: string
  lines: number
  units: number
  value: number | null
  awaitingYou: boolean
}

export function TransfersTable({
  rows,
  total,
  page,
  limit,
  showCost,
  filtered,
}: {
  rows: TransferRow[]
  total: number
  page: number
  limit: number
  showCost: boolean
  filtered: boolean
}) {
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/inventory/transfers/${r.id}`}
      searchPlaceholder="Search number or note…"
      filters={
        <>
          <SelectFilter
            name="status"
            placeholder="All statuses"
            options={[
              { value: "pending", label: "In transit" },
              { value: "completed", label: "Received" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <SelectFilter
            name="direction"
            placeholder="In & out"
            options={[
              { value: "out", label: "Outgoing" },
              { value: "in", label: "Incoming" },
            ]}
          />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        <Button asChild>
          <Link href="/app/inventory/transfers/new">
            <Plus /> New transfer
          </Link>
        </Button>
      }
      empty={
        filtered ? (
          "No transfers match these filters."
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <ArrowRightLeft className="size-5" />
            </span>
            <p>No transfers yet. Move stock between your warehouse and showrooms here.</p>
          </div>
        )
      }
      columns={[
        {
          key: "number",
          header: "Number",
          sortKey: "number",
          cell: (r) => (
            <Link href={`/app/inventory/transfers/${r.id}`} className="num font-medium whitespace-nowrap hover:underline">
              {r.number}
            </Link>
          ),
        },
        { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
        {
          key: "route",
          header: "Route",
          cell: (r) => (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {r.fromName} <ArrowRight className="size-3.5 text-muted-foreground" /> {r.toName}
            </span>
          ),
        },
        { key: "units", header: "Units", align: "right", cell: (r) => <span className="num">{quantity(r.units)}</span> },
        ...(showCost ? [{ key: "value", header: "Value at cost", align: "right" as const, cell: (r: TransferRow) => <span className="num">{money(r.value)}</span> }] : []),
        {
          key: "status",
          header: "Status",
          cell: (r) => (
            <div className="flex items-center gap-1.5">
              <TransferStatusBadge status={r.status} />
              {r.awaitingYou && <StatusBadge tone="primary">To receive</StatusBadge>}
            </div>
          ),
        },
      ]}
    />
  )
}
