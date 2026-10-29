import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Clock, Printer, XCircle } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ApproveReturnButton } from "@/components/sales-after/approve-return"
import { RefundModeBadge, ReturnStatusBadge } from "@/components/sales-after/badges"
import { ReasonDialogButton } from "@/components/sales-after/reason-dialog"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { returnDetail } from "@/server/modules/sales-after/queries"
import { date, dateTime, money, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Return" }

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/sales/returns/${id}`)
  ensurePermission(ctx, "sales.view", "sales.return", "sales.return_approve")
  const r = await returnDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const pending = r.status === "pending"
  const canDecide = pending && can(ctx, "sales.return_approve")
  const customerName = r.customer?.name ?? r.invoice?.customerName ?? "Walk-in customer"
  const showCost = r.costAmount !== null

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/sales/returns", label: "Returns" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{r.number}</span>
            <ReturnStatusBadge status={r.status} />
            <RefundModeBadge mode={r.refundMode} />
          </span>
        }
        description={`${date(r.date)} · ${customerName}${r.requestedBy ? ` · Requested by ${r.requestedBy}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/print/return/${r.id}`} target="_blank" rel="noopener">
                <Printer /> Print {r.creditNote ? "credit note" : "return slip"}
              </a>
            </Button>
            {canDecide && (
              <>
                <ReasonDialogButton
                  label="Reject"
                  icon="x-circle"
                  title={`Reject return ${r.number}?`}
                  description="Nothing moves — no stock, no refund. The requester sees your note."
                  endpoint={`/api/v1/returns/${r.id}/reject`}
                  field="note"
                  confirmLabel="Reject return"
                  placeholder="e.g. Item was damaged at the customer's site"
                  successMessage={`Return ${r.number} rejected`}
                />
                <ApproveReturnButton
                  id={r.id}
                  number={r.number}
                  amount={r.totalAmount}
                  refundMode={r.refundMode}
                  restock={r.restock}
                  customerName={customerName}
                  invoiceDue={r.invoice?.dueAmount ?? 0}
                />
              </>
            )}
          </>
        }
      />

      {pending ? (
        <Banner tone="warning" icon={<Clock className="size-4 text-warning" />}>
          Waiting for approval. Stock and money move only once a manager approves.
          {!can(ctx, "sales.return_approve") && " You can't approve returns yourself."}
        </Banner>
      ) : r.status === "approved" ? (
        <Banner tone="success" icon={<CheckCircle2 className="size-4 text-success" />}>
          Approved {dateTime(r.approvedAt)}
          {r.decidedBy && ` by ${r.decidedBy}`}.{" "}
          {r.creditNote ? (
            <>
              Credit note{" "}
              <Link href={`/app/sales/credit-notes/${r.creditNote.id}`} className="num font-medium underline">
                {r.creditNote.number}
              </Link>{" "}
              for {money(r.creditNote.amount)} issued.
            </>
          ) : (
            <>Refunded {money(r.totalAmount)} in cash.</>
          )}{" "}
          {r.restock ? "Items were restocked." : "Items were not restocked."}
        </Banner>
      ) : (
        <Banner tone="danger" icon={<XCircle className="size-4 text-destructive" />}>
          Rejected{r.decidedBy && ` by ${r.decidedBy}`}: {r.rejectNote}
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <div className="border-b px-5 py-3.5">
            <h2 className="font-semibold">Returned items</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-right text-xs">Sold</TableHead>
                  <TableHead className="text-right text-xs">Returning</TableHead>
                  <TableHead className="text-right text-xs">Price</TableHead>
                  {showCost && <TableHead className="text-right text-xs">Unit cost</TableHead>}
                  <TableHead className="text-right text-xs">Refund</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="py-3">
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.variationName} · <span className="num">{l.sku}</span>
                      </p>
                    </TableCell>
                    <TableCell className="num text-right text-muted-foreground">{quantity(l.soldQty)}</TableCell>
                    <TableCell className="num text-right font-medium">
                      {quantity(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                    </TableCell>
                    <TableCell className="num text-right">{money(l.unitPrice)}</TableCell>
                    {showCost && <TableCell className="num text-right text-muted-foreground">{money(l.unitCost)}</TableCell>}
                    <TableCell className="num text-right font-medium">{money(l.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={showCost ? 5 : 4} className="text-right text-xs text-muted-foreground">
                    {pending ? "Estimated refund (final amount set on approval)" : "Refund total"}
                    {showCost && ` · cost of goods ${money(r.costAmount)}`}
                  </TableCell>
                  <TableCell className="num text-right font-semibold">{money(r.totalAmount)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Details</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Item label="Invoice">
              {r.invoice ? (
                <Link href={`/app/sales/invoices/${r.invoice.id}`} className="num font-medium hover:underline">
                  {r.invoice.number}
                </Link>
              ) : (
                "—"
              )}
            </Item>
            {r.invoice && (
              <>
                <Item label="Invoice type">
                  <span className="capitalize">{r.invoice.type}</span>
                </Item>
                <Item label="Invoice status">
                  <span className="capitalize">{r.invoice.status.replace("_", " ")}</span>
                </Item>
                <Item label="Invoice due">
                  <span className="num">{money(r.invoice.dueAmount)}</span>
                </Item>
              </>
            )}
            <Item label="Customer">{customerName}</Item>
            <Item label="Restock">{r.restock ? <StatusBadge tone="success">Yes</StatusBadge> : <StatusBadge tone="neutral">No — written off</StatusBadge>}</Item>
            <Item label="Requested">{dateTime(r.createdAt)}</Item>
          </dl>
          {r.reason && (
            <div className="mt-4 border-t pt-3 text-sm">
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="mt-0.5">{r.reason}</p>
            </div>
          )}
        </section>
      </div>
    </PageBody>
  )
}

function Banner({ tone, icon, children }: { tone: "warning" | "success" | "danger"; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = { warning: "border-warning/40 bg-warning/10", success: "border-success/30 bg-success/5", danger: "border-destructive/30 bg-destructive/5" }[tone]
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
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
