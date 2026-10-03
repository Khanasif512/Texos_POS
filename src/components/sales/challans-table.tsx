"use client"

import Link from "next/link"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { date } from "@/lib/format"
import { ChallanStatusBadge, InvoiceStatusBadge, PrintStatusBadge } from "./badges"
import { ChallanActions, type ChallanEditable } from "./challan-actions"

export type ChallanRow = ChallanEditable & {
  createdAt: string
  deliveredAt: string | null
  printCount: number
  branchCode: string
  invoiceId: string
  invoiceNumber: string
  invoiceStatus: string
  customerName: string | null
  customerPhone: string | null
}

export function ChallansTable({ rows, total, page, limit }: { rows: ChallanRow[]; total: number; page: number; limit: number }) {
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      searchPlaceholder="Challan / invoice no., customer, phone…"
      filters={
        <>
          <SelectFilter
            name="status"
            placeholder="All statuses"
            options={[
              { value: "pending", label: "Pending" },
              { value: "delivered", label: "Delivered" },
            ]}
          />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      empty="No challans yet. Every confirmed invoice creates one."
      columns={[
        {
          key: "number",
          header: "Challan",
          sortKey: "number",
          cell: (r) => (
            <div>
              <p className="num font-medium">{r.number}</p>
              <p className="text-xs text-muted-foreground">
                {r.branchCode} · {date(r.createdAt)}
              </p>
            </div>
          ),
        },
        {
          key: "invoice",
          header: "Invoice",
          cell: (r) => (
            <div className="flex flex-col items-start gap-1">
              <Link href={`/app/sales/invoices/${r.invoiceId}`} className="num text-primary hover:underline">
                {r.invoiceNumber}
              </Link>
              {r.invoiceStatus === "cancelled" && <InvoiceStatusBadge status={r.invoiceStatus} />}
            </div>
          ),
        },
        {
          key: "customer",
          header: "Customer / address",
          cell: (r) => (
            <div className="max-w-[240px]">
              <p className="truncate">{r.customerName || "Walk-in"}</p>
              <p className="truncate text-xs text-muted-foreground">{r.deliveryAddress || r.customerPhone || "—"}</p>
            </div>
          ),
        },
        {
          key: "delivery",
          header: "Delivery",
          cell: (r) => (
            <div className="text-xs">
              <p>{r.deliveryPerson ?? <span className="text-muted-foreground">Not assigned</span>}</p>
              <p className="text-muted-foreground">
                {[r.vehicleNo, r.deliveredAt ? `Delivered ${date(r.deliveredAt)}` : r.deliveryDate && `Due ${date(r.deliveryDate)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          ),
        },
        { key: "status", header: "Status", cell: (r) => <ChallanStatusBadge status={r.status} /> },
        { key: "print", header: "Print", cell: (r) => <PrintStatusBadge count={r.printCount} /> },
        { key: "actions", header: "", align: "right", cell: (r) => <ChallanActions challan={r} compact /> },
      ]}
    />
  )
}
