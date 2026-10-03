import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Ban, Printer } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ApplyAdvanceButton } from "@/components/sales-after/apply-advance-button"
import { ReceiptStatusBadge, methodLabel } from "@/components/sales-after/badges"
import { ReasonDialogButton } from "@/components/sales-after/reason-dialog"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { receiptDetail } from "@/server/modules/sales-after/queries"
import { customerDueSummary } from "@/server/modules/sales-after/receipts"
import { date, dateTime, money } from "@/lib/format"

export const metadata: Metadata = { title: "Money receipt" }

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/sales/receipts/${id}`)
  ensurePermission(ctx, "sales.view", "sales.receipt")
  const db = tenantDb(ctx.companyId)
  const r = await receiptDetail(ctx, db, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const cancelled = !!r.cancelledAt
  const summary = r.customer && !cancelled && r.unallocated > 0 ? await customerDueSummary(ctx, db, r.customer.id) : null

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/sales/receipts", label: "Money receipts" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{r.number}</span>
            <ReceiptStatusBadge cancelled={cancelled} isAdvance={r.isAdvance} unallocated={r.unallocated} />
            {r.printCount > 0 && <StatusBadge tone="neutral">Printed ×{r.printCount}</StatusBadge>}
          </span>
        }
        description={`${dateTime(r.date)} · ${r.branchName}${r.createdBy ? ` · Received by ${r.createdBy}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/print/receipt/${r.id}`} target="_blank" rel="noopener">
                <Printer /> Print receipt
              </a>
            </Button>
            {summary && summary.openInvoices.length > 0 && (
              <ApplyAdvanceButton customerId={r.customer!.id} amount={summary.unappliedAdvance} totalDue={summary.totalDue} size="default" />
            )}
            {!cancelled && can(ctx, "sales.cancel") && (
              <ReasonDialogButton
                label="Cancel receipt"
                title={`Cancel ${r.number}?`}
                description={
                  <>
                    {money(r.amount)} will be reversed: {r.allocations.length ? `${money(r.allocated)} comes off the paid amount of ${r.allocations.map((a) => a.number).join(", ")}, ` : ""}
                    and the customer ledger is debited back. This cannot be undone.
                  </>
                }
                endpoint={`/api/v1/receipts/${r.id}/cancel`}
                confirmLabel="Cancel receipt"
                placeholder="e.g. Cheque bounced"
                successMessage={`Receipt ${r.number} cancelled`}
              />
            )}
          </>
        }
      />

      {cancelled && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Cancelled {dateTime(r.cancelledAt)}</p>
            <p className="mt-0.5 text-muted-foreground">Invoice allocations were reversed and the customer ledger debited back.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <div className="border-b px-5 py-3.5">
            <h2 className="font-semibold">Allocated to invoices</h2>
          </div>
          {r.allocations.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              {cancelled ? "Allocations were reversed when the receipt was cancelled." : "Not allocated to any invoice — the whole amount is a customer advance."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs">Invoice</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-right text-xs">Invoice total</TableHead>
                    <TableHead className="text-right text-xs">Due now</TableHead>
                    <TableHead className="text-right text-xs">Allocated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link href={`/app/sales/invoices/${a.invoiceId}`} className="num font-medium hover:underline">
                          {a.number}
                        </Link>
                      </TableCell>
                      <TableCell>{date(a.invoiceDate)}</TableCell>
                      <TableCell className="num text-right text-muted-foreground">{money(a.invoiceTotal)}</TableCell>
                      <TableCell className="num text-right">{money(a.dueNow)}</TableCell>
                      <TableCell className="num text-right font-medium">{money(a.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Payment</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Item label="Received from">
              {r.customer ? (
                <span className="text-right">
                  <span className="block font-medium">{r.customer.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.customer.code}
                    {r.customer.phone && ` · ${r.customer.phone}`}
                  </span>
                </span>
              ) : (
                "—"
              )}
            </Item>
            <Item label="Method">{methodLabel(r.method)}</Item>
            {r.reference && <Item label="Reference">{r.reference}</Item>}
            <div className="my-1 border-t" />
            <Item label="Amount">
              <span className={`num text-base font-semibold ${cancelled ? "line-through" : ""}`}>{money(r.amount)}</span>
            </Item>
            <Item label="Allocated">
              <span className="num">{money(r.allocated)}</span>
            </Item>
            <Item label="Unapplied advance">
              <span className={`num ${r.unallocated > 0 ? "font-medium text-info" : ""}`}>{money(r.unallocated)}</span>
            </Item>
            {r.customer && (
              <Item label="Customer balance now">
                <span className={`num ${r.customer.balance > 0 ? "text-destructive" : "text-success"}`}>{money(r.customer.balance)}</span>
              </Item>
            )}
          </dl>
          {r.note && <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">{r.note}</p>}
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
