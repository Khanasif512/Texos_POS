"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCan } from "@/components/app/app-context"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { date, money, quantity } from "@/lib/format"
import type { CreditNoteRow, OrderRow, ReceiptRow, ReturnRow } from "@/server/modules/sales-after/queries"
import { METHOD_OPTIONS, OrderStatusBadge, OrderTypeBadge, ReceiptStatusBadge, RefundModeBadge, ReturnStatusBadge, methodLabel } from "./badges"
import { CreditNoteDialogButton } from "./credit-note-dialog"

type Paged<T> = { rows: T[]; total: number; page: number; limit: number }

export function ReceiptsTable(p: Paged<ReceiptRow>) {
  const canCreate = useCan("sales.receipt")
  return (
    <ServerTable
      {...p}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/sales/receipts/${r.id}`}
      searchPlaceholder="Receipt no, customer, reference…"
      filters={
        <>
          <SelectFilter name="method" placeholder="All methods" options={METHOD_OPTIONS} />
          <SelectFilter
            name="kind"
            placeholder="All receipts"
            options={[
              { value: "payment", label: "Invoice payments" },
              { value: "advance", label: "With advance" },
            ]}
          />
          <SelectFilter
            name="status"
            placeholder="Any status"
            options={[
              { value: "active", label: "Active" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        canCreate && (
          <Button asChild>
            <Link href="/app/sales/receipts/new">
              <Plus /> New receipt
            </Link>
          </Button>
        )
      }
      empty="No money receipts in this period."
      columns={[
        { key: "number", header: "Receipt", sortKey: "number", cell: (r) => <span className="num font-medium">{r.number}</span> },
        { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
        {
          key: "customer",
          header: "Customer",
          cell: (r) => (
            <div className="min-w-0">
              <p className="truncate">{r.customerName}</p>
              <p className="text-xs text-muted-foreground">{r.branchName}</p>
            </div>
          ),
        },
        {
          key: "invoices",
          header: "Invoice(s)",
          cell: (r) =>
            r.invoices.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <span className="num text-xs">
                {r.invoices.slice(0, 2).map((i) => i.number).join(", ")}
                {r.invoices.length > 2 && ` +${r.invoices.length - 2}`}
              </span>
            ),
        },
        {
          key: "method",
          header: "Method",
          cell: (r) => (
            <div>
              <p>{methodLabel(r.method)}</p>
              {r.reference && <p className="max-w-[140px] truncate text-xs text-muted-foreground">{r.reference}</p>}
            </div>
          ),
        },
        {
          key: "amount",
          header: "Amount",
          sortKey: "amount",
          align: "right",
          cell: (r) => (
            <div>
              <p className={`num font-medium ${r.cancelled ? "text-muted-foreground line-through" : ""}`}>{money(r.amount)}</p>
              {r.unallocated > 0 && <p className="num text-xs text-info">{money(r.unallocated)} unapplied</p>}
            </div>
          ),
        },
        { key: "status", header: "Status", cell: (r) => <ReceiptStatusBadge cancelled={r.cancelled} isAdvance={r.isAdvance} unallocated={r.unallocated} /> },
      ]}
    />
  )
}

export function ReturnsTable(p: Paged<ReturnRow>) {
  const canCreate = useCan("sales.return")
  return (
    <ServerTable
      {...p}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/sales/returns/${r.id}`}
      searchPlaceholder="Return no, invoice no, customer…"
      filters={
        <>
          <SelectFilter
            name="status"
            placeholder="Any status"
            options={[
              { value: "pending", label: "Pending approval" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
          <SelectFilter
            name="mode"
            placeholder="Any refund"
            options={[
              { value: "credit_note", label: "Credit note" },
              { value: "cash", label: "Cash refund" },
            ]}
          />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        canCreate && (
          <Button asChild>
            <Link href="/app/sales/returns/new">
              <Plus /> New return
            </Link>
          </Button>
        )
      }
      empty="No returns in this period."
      columns={[
        { key: "number", header: "Return", sortKey: "number", cell: (r) => <span className="num font-medium">{r.number}</span> },
        { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
        { key: "invoice", header: "Invoice", cell: (r) => <span className="num text-xs">{r.invoiceNumber}</span> },
        {
          key: "customer",
          header: "Customer",
          cell: (r) => (
            <div className="min-w-0">
              <p className="truncate">{r.customerName}</p>
              <p className="max-w-[220px] truncate text-xs text-muted-foreground">{r.reason ?? r.branchName}</p>
            </div>
          ),
        },
        { key: "items", header: "Items", align: "right", cell: (r) => <span className="num">{quantity(r.items)}</span> },
        {
          key: "mode",
          header: "Refund",
          cell: (r) => (
            <div className="flex flex-wrap items-center gap-1">
              <RefundModeBadge mode={r.refundMode} />
              {!r.restock && <StatusBadge tone="neutral">No restock</StatusBadge>}
            </div>
          ),
        },
        { key: "amount", header: "Amount", sortKey: "totalAmount", align: "right", cell: (r) => <span className="num font-medium">{money(r.totalAmount)}</span> },
        { key: "status", header: "Status", cell: (r) => <ReturnStatusBadge status={r.status} /> },
      ]}
    />
  )
}

export function CreditNotesTable(p: Paged<CreditNoteRow>) {
  return (
    <ServerTable
      {...p}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/sales/credit-notes/${r.id}`}
      searchPlaceholder="Credit note no, customer, reason…"
      filters={
        <>
          <SelectFilter
            name="source"
            placeholder="All sources"
            options={[
              { value: "return", label: "From returns" },
              { value: "manual", label: "Manual" },
            ]}
          />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={<CreditNoteDialogButton />}
      empty="No credit notes yet. They are issued when a return is approved with a credit-note refund."
      columns={[
        { key: "number", header: "Credit note", sortKey: "number", cell: (r) => <span className="num font-medium">{r.number}</span> },
        { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
        {
          key: "customer",
          header: "Customer",
          cell: (r) => (
            <div className="min-w-0">
              <p className="truncate">{r.customerName}</p>
              <p className="text-xs text-muted-foreground">{r.branchName}</p>
            </div>
          ),
        },
        {
          key: "source",
          header: "Source",
          cell: (r) =>
            r.returnNumber ? (
              <span className="num text-xs">Return {r.returnNumber}</span>
            ) : (
              <StatusBadge tone="neutral">Manual</StatusBadge>
            ),
        },
        { key: "invoice", header: "Invoice", cell: (r) => <span className="num text-xs">{r.invoiceNumber ?? "—"}</span> },
        { key: "reason", header: "Reason", cell: (r) => <span className="line-clamp-1 max-w-[260px] text-muted-foreground">{r.reason ?? "—"}</span> },
        { key: "amount", header: "Amount", sortKey: "amount", align: "right", cell: (r) => <span className="num font-medium">{money(r.amount)}</span> },
      ]}
    />
  )
}

export function OrdersTable(p: Paged<OrderRow>) {
  const canCreate = useCan("sales.create")
  return (
    <ServerTable
      {...p}
      rowKey={(r) => r.id}
      onRowHref={(r) => `/app/sales/orders/${r.id}`}
      searchPlaceholder="Number, customer, note…"
      filters={
        <>
          <SelectFilter
            name="type"
            placeholder="All types"
            options={[
              { value: "quotation", label: "Quotations" },
              { value: "order", label: "Sales orders" },
            ]}
          />
          <SelectFilter
            name="status"
            placeholder="Any status"
            options={[
              { value: "open", label: "Open" },
              { value: "converted", label: "Converted" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
          <BranchFilter />
          <DateRangeFilter />
        </>
      }
      actions={
        canCreate && (
          <>
            <Button variant="outline" asChild>
              <Link href="/app/sales/orders/new?type=quotation">
                <Plus /> Quotation
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/sales/orders/new?type=order">
                <Plus /> Sales order
              </Link>
            </Button>
          </>
        )
      }
      empty="No quotations or orders yet."
      columns={[
        {
          key: "number",
          header: "Number",
          sortKey: "number",
          cell: (r) => (
            <div>
              <p className="num font-medium">{r.number}</p>
              <OrderTypeBadge type={r.type} />
            </div>
          ),
        },
        { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(r.date)}</span> },
        {
          key: "customer",
          header: "Customer",
          cell: (r) => (
            <div className="min-w-0">
              <p className={`truncate ${r.customerName ? "" : "text-muted-foreground"}`}>{r.customerName ?? "No customer"}</p>
              <p className="text-xs text-muted-foreground">{r.branchName}</p>
            </div>
          ),
        },
        { key: "valid", header: "Valid until", cell: (r) => <span className={r.expired ? "text-warning" : ""}>{date(r.validUntil)}</span> },
        { key: "items", header: "Items", align: "right", cell: (r) => <span className="num">{r.items}</span> },
        {
          key: "total",
          header: "Total",
          sortKey: "total",
          align: "right",
          cell: (r) => (
            <div>
              <p className="num font-medium">{money(r.total)}</p>
              {r.advanceAmount > 0 && <p className="num text-xs text-info">Adv. {money(r.advanceAmount)}</p>}
            </div>
          ),
        },
        { key: "status", header: "Status", cell: (r) => <OrderStatusBadge status={r.status} expired={r.expired} /> },
      ]}
    />
  )
}
