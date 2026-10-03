"use client"

import Link from "next/link"
import { ClipboardList, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { date, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ADJUSTMENT_REASONS } from "@/lib/validation/inventory"

export type AdjustmentRow = {
  id: string
  number: string
  date: string
  branchName: string
  reason: string
  note: string | null
  lines: number
  unitsIn: number
  unitsOut: number
  value: number | null
}

const reasonLabel = (r: string) => ADJUSTMENT_REASONS.find((x) => x.value === r)?.label ?? r

export function AdjustmentsTable({
  rows,
  total,
  page,
  limit,
  showCost,
  filtered,
}: {
  rows: AdjustmentRow[]
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
      onRowHref={(r) => `/app/inventory/adjustments/${r.id}`}
      searchPlaceholder="Search number or note…"
      filters={
        <>
          <SelectFilter name="reason" placeholder="All reasons" options={ADJUSTMENT_REASONS.map((r) => ({ value: r.value, label: r.label }))} />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        <Button asChild>
          <Link href="/app/inventory/adjustments/new">
            <Plus /> New adjustment
          </Link>
        </Button>
      }
      empty={
        filtered ? (
          "No adjustments match these filters."
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <ClipboardList className="size-5" />
            </span>
            <p>No stock adjustments yet. Record damage, count corrections and found stock here.</p>
          </div>
        )
      }
      columns={[
        {
          key: "number",
          header: "Number",
          sortKey: "number",
          cell: (r) => (
            <Link href={`/app/inventory/adjustments/${r.id}`} className="num font-medium whitespace-nowrap hover:underline">
              {r.number}
            </Link>
          ),
        },
        { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
        {
          key: "reason",
          header: "Reason",
          cell: (r) => (
            <div className="min-w-[140px]">
              <StatusBadge tone={r.reason === "found" ? "success" : r.reason === "count_correction" ? "info" : "warning"}>{reasonLabel(r.reason)}</StatusBadge>
              {r.note && <p className="mt-0.5 max-w-[260px] truncate text-xs text-muted-foreground">{r.note}</p>}
            </div>
          ),
        },
        { key: "branch", header: "Branch", cell: (r) => <span className="text-muted-foreground">{r.branchName}</span> },
        {
          key: "units",
          header: "Units ±",
          align: "right",
          cell: (r) => (
            <span className="num whitespace-nowrap">
              {r.unitsIn > 0 && <span className="text-success">+{quantity(r.unitsIn)}</span>}
              {r.unitsIn > 0 && r.unitsOut > 0 && " / "}
              {r.unitsOut > 0 && <span className="text-destructive">−{quantity(r.unitsOut)}</span>}
            </span>
          ),
        },
        ...(showCost
          ? [
              {
                key: "value",
                header: "Net value",
                align: "right" as const,
                cell: (r: AdjustmentRow) => <span className={cn("num", (r.value ?? 0) < 0 ? "text-destructive" : "text-success")}>{money(r.value)}</span>,
              },
            ]
          : []),
      ]}
    />
  )
}
