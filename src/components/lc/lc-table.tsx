"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, SelectFilter } from "@/components/shared/filters"
import { useCan } from "@/components/app/app-context"
import { amount, date, money } from "@/lib/format"
import { LC_STATUSES, LC_STATUS_LABEL } from "@/lib/validation/lc"
import { CostItemDialog } from "./cost-sheet"
import { LcStatusBadge } from "./lc-status"
import { rate } from "./lc-format"

export type LcRow = {
  id: string
  lcNumber: string
  supplierName: string
  issuingBank: string
  branchName: string
  currency: string
  lcValue: number | null
  exchangeRate: number
  status: string
  openedDate: string | null
  expectedArrivalDate: string | null
  actualArrivalDate: string | null
  landedTotal: number | null
  snapshotVersion: number | null
}

export function LcTable({
  rows,
  total,
  page,
  limit,
  suppliers,
  showCost,
}: {
  rows: LcRow[]
  total: number
  page: number
  limit: number
  suppliers: { id: string; name: string }[]
  showCost: boolean
}) {
  const canCreate = useCan("lc.create")
  const canUpdate = useCan("lc.update")
  const [costLcId, setCostLcId] = useState<string | null>(null)
  return (
    <>
      <ServerTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        rowKey={(r) => r.id}
        onRowHref={(r) => `/app/lc/${r.id}`}
        searchPlaceholder="Search LC no., bank or supplier…"
        filters={
          <>
            <SelectFilter name="status" placeholder="All statuses" options={LC_STATUSES.map((s) => ({ value: s, label: LC_STATUS_LABEL[s] }))} />
            {suppliers.length > 0 && <SelectFilter name="supplierId" placeholder="All suppliers" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />}
            <BranchFilter />
          </>
        }
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/app/lc/new">
                <Plus /> New LC
              </Link>
            </Button>
          )
        }
        empty={
          <div className="space-y-1">
            <p className="font-medium text-foreground">No LCs yet</p>
            <p>Open an LC to track an import shipment and calculate its landed cost per unit.</p>
          </div>
        }
        columns={[
        {
          key: "lcNumber",
          header: "LC no.",
          sortKey: "lcNumber",
          cell: (r) => (
            <div>
              <Link href={`/app/lc/${r.id}`} className="num font-medium hover:text-primary hover:underline">
                {r.lcNumber}
              </Link>
              <p className="text-xs text-muted-foreground">{r.openedDate ? `Opened ${date(r.openedDate)}` : r.branchName}</p>
            </div>
          ),
        },
        {
          key: "supplier",
          header: "Supplier",
          cell: (r) => <span className="line-clamp-2 max-w-[220px]">{r.supplierName}</span>,
        },
        { key: "bank", header: "Bank", cell: (r) => <span className="line-clamp-2 max-w-[180px] text-muted-foreground">{r.issuingBank}</span> },
        ...(showCost
          ? [
              {
                key: "value",
                header: "LC value",
                align: "right" as const,
                cell: (r: LcRow) => (
                  <span className="num whitespace-nowrap">
                    <span className="text-xs text-muted-foreground">{r.currency}</span> {amount(r.lcValue)}
                  </span>
                ),
              },
            ]
          : []),
        {
          key: "rate",
          header: "Rate",
          align: "right",
          cell: (r) => (r.exchangeRate > 0 ? <span className="num">{rate(r.exchangeRate)}</span> : <span className="text-muted-foreground">—</span>),
        },
        { key: "status", header: "Status", sortKey: "status", cell: (r) => <LcStatusBadge status={r.status} /> },
        {
          key: "arrival",
          header: "Arrival",
          sortKey: "expectedArrivalDate",
          cell: (r) =>
            r.actualArrivalDate ? (
              <div className="whitespace-nowrap">
                <p>{date(r.actualArrivalDate)}</p>
                <p className="text-xs text-success">Arrived</p>
              </div>
            ) : r.expectedArrivalDate ? (
              <div className="whitespace-nowrap">
                <p>{date(r.expectedArrivalDate)}</p>
                <p className={new Date(r.expectedArrivalDate) < new Date() ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {new Date(r.expectedArrivalDate) < new Date() ? "Overdue" : "Expected"}
                </p>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        ...(showCost
          ? [
              {
                key: "landed",
                header: "Landed value",
                align: "right" as const,
                cell: (r: LcRow) =>
                  r.landedTotal != null ? (
                    <div className="whitespace-nowrap">
                      <p className="num font-medium">{money(r.landedTotal)}</p>
                      <p className="text-xs text-muted-foreground">v{r.snapshotVersion}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not calculated</span>
                  ),
              },
            ]
          : []),
        ...(canUpdate
          ? [
              {
                key: "costAction",
                header: "Cost heads",
                align: "right" as const,
                cell: (r: LcRow) =>
                  r.status !== "closed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCostLcId(r.id)}
                      aria-label={`Add cost to LC ${r.lcNumber}`}
                    >
                      <ReceiptText /> Add cost
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  ),
              },
            ]
          : []),
        ]}
      />
      {costLcId && <CostItemDialog lcId={costLcId} row={null} onClose={() => setCostLcId(null)} />}
    </>
  )
}
