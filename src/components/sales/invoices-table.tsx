"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { useCan } from "@/components/app/app-context"
import { date, money } from "@/lib/format"
import { InvoiceStatusBadge, InvoiceTypeBadge, PrintStatusBadge } from "./badges"

export type InvoiceRow = {
  id: string
  number: string
  invoiceDate: string
  customerName: string | null
  customerPhone: string | null
  hasCustomer: boolean
  type: string
  total: number
  paidAmount: number
  dueAmount: number
  status: string
  printCount: number
  salesman: string | null
  branchCode: string
}

export function InvoicesTable({
  rows,
  total,
  page,
  limit,
  salesmen,
  showSalesmanFilter,
}: {
  rows: InvoiceRow[]
  total: number
  page: number
  limit: number
  salesmen: { id: string; name: string }[]
  showSalesmanFilter: boolean
}) {
  const canCreate = useCan("sales.create")
  return (
    <ServerTable
      rows={rows}
      total={total}
      page={page}
      limit={limit}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/sales/invoices/${r.id}`}
      searchPlaceholder="Invoice no., customer or phone…"
      filters={
        <>
          <SelectFilter
            name="type"
            placeholder="All types"
            options={[
              { value: "cash", label: "Cash" },
              { value: "credit", label: "Credit" },
            ]}
          />
          <SelectFilter
            name="status"
            placeholder="All statuses"
            options={[
              { value: "confirmed", label: "Confirmed" },
              { value: "partially_returned", label: "Part returned" },
              { value: "returned", label: "Returned" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          {showSalesmanFilter && salesmen.length > 1 && (
            <SelectFilter name="salesmanId" placeholder="All salesmen" options={salesmen.map((s) => ({ value: s.id, label: s.name }))} />
          )}
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        canCreate && (
          <Button asChild>
            <Link href="/app/pos">
              <Plus /> New sale
            </Link>
          </Button>
        )
      }
      empty="No invoices yet. Sales made on the POS appear here."
      columns={[
        {
          key: "number",
          header: "Invoice",
          sortKey: "number",
          cell: (r) => (
            <div>
              <p className="num font-medium">{r.number}</p>
              <p className="text-xs text-muted-foreground">{r.branchCode}</p>
            </div>
          ),
        },
        { key: "date", header: "Date", sortKey: "invoiceDate", cell: (r) => <span className="whitespace-nowrap">{date(r.invoiceDate)}</span> },
        {
          key: "customer",
          header: "Customer",
          cell: (r) => (
            <div className="max-w-[200px]">
              <p className="truncate">{r.customerName || <span className="text-muted-foreground">Walk-in</span>}</p>
              {r.customerPhone && <p className="num truncate text-xs text-muted-foreground">{r.customerPhone}</p>}
            </div>
          ),
        },
        { key: "type", header: "Type", cell: (r) => <InvoiceTypeBadge type={r.type} /> },
        { key: "total", header: "Total", align: "right", sortKey: "total", cell: (r) => <span className="num font-medium">{money(r.total)}</span> },
        { key: "paid", header: "Paid", align: "right", cell: (r) => <span className="num text-muted-foreground">{money(r.paidAmount)}</span> },
        {
          key: "due",
          header: "Due",
          align: "right",
          sortKey: "dueAmount",
          cell: (r) => <span className={r.dueAmount > 0 && r.status !== "cancelled" ? "num font-medium text-destructive" : "num text-muted-foreground"}>{money(r.dueAmount)}</span>,
        },
        { key: "status", header: "Status", cell: (r) => <InvoiceStatusBadge status={r.status} /> },
        { key: "print", header: "Print", cell: (r) => <PrintStatusBadge count={r.printCount} /> },
        { key: "salesman", header: "Salesman", cell: (r) => <span className="text-sm whitespace-nowrap">{r.salesman ?? "—"}</span> },
      ]}
    />
  )
}
