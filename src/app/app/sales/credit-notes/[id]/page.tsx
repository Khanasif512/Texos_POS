import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Printer } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { creditNoteDetail } from "@/server/modules/sales-after/queries"
import { dateTime, money } from "@/lib/format"

export const metadata: Metadata = { title: "Credit note" }

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/sales/credit-notes/${id}`)
  ensurePermission(ctx, "sales.view")
  const c = await creditNoteDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  return (
    <PageBody className="max-w-4xl">
      <PageHeader
        back={{ href: "/app/sales/credit-notes", label: "Credit notes" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{c.number}</span>
            {c.salesReturn ? <StatusBadge tone="primary">From return</StatusBadge> : <StatusBadge tone="neutral">Manual</StatusBadge>}
          </span>
        }
        description={`${dateTime(c.date)} · ${c.branchName}${c.createdBy ? ` · Issued by ${c.createdBy}` : ""}`}
        actions={
          c.salesReturn && (
            <Button variant="outline" asChild>
              <a href={`/print/return/${c.salesReturn.id}`} target="_blank" rel="noopener">
                <Printer /> Print credit note
              </a>
            </Button>
          )
        }
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Credit amount</p>
          <p className="num mt-1 text-3xl font-semibold tracking-tight">{money(c.amount)}</p>
          {c.reason && <p className="mt-4 border-t pt-3 text-sm">{c.reason}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            Credited to the customer ledger{c.balanceAfter !== null && <> — balance after posting {money(c.balanceAfter)}</>}.
          </p>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <dl className="grid gap-2.5 text-sm">
            <Item label="Customer">
              {c.customer ? (
                <span>
                  <span className="block font-medium">{c.customer.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.customer.code} · balance <span className="num">{money(c.customer.balance)}</span>
                  </span>
                </span>
              ) : (
                "—"
              )}
            </Item>
            <Item label="Invoice">
              {c.invoice ? (
                <Link href={`/app/sales/invoices/${c.invoice.id}`} className="num font-medium hover:underline">
                  {c.invoice.number}
                </Link>
              ) : (
                "None (account credit)"
              )}
            </Item>
            {c.invoice && (
              <Item label="Invoice due now">
                <span className="num">{money(c.invoice.dueAmount)}</span>
              </Item>
            )}
            <Item label="Return">
              {c.salesReturn ? (
                <Link href={`/app/sales/returns/${c.salesReturn.id}`} className="num font-medium hover:underline">
                  {c.salesReturn.number}
                </Link>
              ) : (
                "—"
              )}
            </Item>
          </dl>
        </section>
      </div>
    </PageBody>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}
