"use client"

import Link from "next/link"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { TXN_LABEL } from "@/components/purchasing/status"
import { dateTime, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export type LedgerRow = {
  id: string
  at: string
  type: string
  branchName: string
  quantity: number
  balanceAfter: number
  unitCost: number | null
  ref: { label: string; number: string | null; href: string | null }
  note: string | null
  user: string | null
}

const TONE: Record<string, "success" | "danger" | "info" | "warning" | "neutral" | "primary"> = {
  opening: "primary",
  purchase_in: "success",
  sale_out: "info",
  return_in: "success",
  cancel_in: "neutral",
  adjustment_in: "warning",
  adjustment_out: "warning",
  transfer_in: "primary",
  transfer_out: "primary",
}

export function StockLedgerTable({ rows, total, page, limit, showCost }: { rows: LedgerRow[]; total: number; page: number; limit: number; showCost: boolean }) {
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      searchPlaceholder="Search movement notes…"
      filters={
        <>
          <BranchFilter />
          <SelectFilter name="type" placeholder="All movements" options={Object.entries(TXN_LABEL).map(([value, label]) => ({ value, label }))} />
          <DateRangeFilter />
        </>
      }
      empty="No stock movements yet."
      columns={[
        { key: "at", header: "When", cell: (r) => <span className="text-xs whitespace-nowrap text-muted-foreground">{dateTime(r.at)}</span> },
        { key: "type", header: "Movement", cell: (r) => <StatusBadge tone={TONE[r.type] ?? "neutral"}>{TXN_LABEL[r.type] ?? r.type}</StatusBadge> },
        {
          key: "ref",
          header: "Reference",
          cell: (r) => (
            <div className="min-w-[140px]">
              {r.ref.href ? (
                <Link href={r.ref.href} className="num text-sm hover:underline">
                  {r.ref.number}
                </Link>
              ) : (
                <span className="text-sm">{r.ref.number ?? r.ref.label}</span>
              )}
              {r.note && <p className="max-w-[260px] truncate text-xs text-muted-foreground">{r.note}</p>}
            </div>
          ),
        },
        { key: "branch", header: "Branch", cell: (r) => <span className="text-muted-foreground">{r.branchName}</span> },
        {
          key: "qty",
          header: "Qty",
          align: "right",
          cell: (r) => (
            <span className={cn("num font-medium", r.quantity > 0 ? "text-success" : "text-destructive")}>
              {r.quantity > 0 ? "+" : "−"}
              {quantity(Math.abs(r.quantity))}
            </span>
          ),
        },
        { key: "bal", header: "Balance", align: "right", cell: (r) => <span className="num">{quantity(r.balanceAfter)}</span> },
        ...(showCost ? [{ key: "cost", header: "Unit cost", align: "right" as const, cell: (r: LedgerRow) => <span className="num text-muted-foreground">{money(r.unitCost)}</span> }] : []),
        { key: "user", header: "By", cell: (r) => <span className="text-xs text-muted-foreground">{r.user ?? "—"}</span> },
      ]}
    />
  )
}
