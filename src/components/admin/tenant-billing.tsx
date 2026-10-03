"use client"

import { useState } from "react"
import Link from "next/link"
import { FilePlus2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { date, money } from "@/lib/format"
import { BILLING_STATUS_LABELS, billingStatusTone } from "@/lib/validation/billing"
import { ManualInvoiceDialog } from "./billing-invoices-table"
import { InvoiceActions } from "./invoice-actions"

type Inv = {
  id: string
  number: string
  description: string | null
  amount: number
  status: string
  issuedAt: string
  dueAt: string | null
  paidAt: string | null
  paymentReference: string | null
}

/** Tenant detail: billing invoices with quick "mark paid", and a manual invoice for this company. */
export function TenantBilling({
  company,
  invoices,
  plans,
}: {
  company: { id: string; name: string }
  invoices: Inv[]
  plans: { id: string; name: string; priceMonthly: number; priceYearly: number }[]
}) {
  const [creating, setCreating] = useState(false)
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h2 className="font-semibold">Billing invoices ({invoices.length})</h2>
        <div className="flex gap-2">
          {invoices.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/billing?companyId=${company.id}`}>View all</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <FilePlus2 /> New invoice
          </Button>
        </div>
      </div>
      {invoices.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No billing invoices yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="num font-medium">{i.number}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {i.description} · issued {date(i.issuedAt)}
                  {i.status === "paid" ? ` · paid ${date(i.paidAt)}` : i.dueAt ? ` · due ${date(i.dueAt)}` : ""}
                  {i.paymentReference ? ` · ref ${i.paymentReference}` : ""}
                </p>
              </div>
              <span className="num font-medium">{money(i.amount)}</span>
              <StatusBadge tone={billingStatusTone(i.status)}>{BILLING_STATUS_LABELS[i.status as keyof typeof BILLING_STATUS_LABELS] ?? i.status}</StatusBadge>
              <InvoiceActions invoice={{ id: i.id, number: i.number, amount: i.amount, status: i.status, companyName: company.name, paymentReference: i.paymentReference }} compact />
            </li>
          ))}
        </ul>
      )}
      {creating && <ManualInvoiceDialog companies={[company]} plans={plans} companyId={company.id} onClose={() => setCreating(false)} />}
    </section>
  )
}
