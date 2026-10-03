import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Ban, CheckCircle2, Pencil, Printer, ShoppingCart, WalletCards } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApplyAdvanceButton } from "@/components/sales-after/apply-advance-button"
import { OrderStatusBadge, OrderTypeBadge } from "@/components/sales-after/badges"
import { OrderAdvanceButton } from "@/components/sales-after/order-advance"
import { ReasonDialogButton } from "@/components/sales-after/reason-dialog"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getOrder } from "@/server/modules/sales-after/orders"
import { customerDueSummary } from "@/server/modules/sales-after/receipts"
import { ADVANCE_NOTE_PREFIX } from "@/server/modules/sales-after/shared"
import { date, dateTime, money, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Quotation / order" }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/sales/orders/${id}`)
  ensurePermission(ctx, "sales.view", "sales.create")
  const db = tenantDb(ctx.companyId)
  const o = await getOrder(ctx, db, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const open = o.status === "open"
  const isOrder = o.type === "order"
  const today = new Date().toISOString().slice(0, 10)
  const expired = open && !!o.validUntil && o.validUntil < today
  const advances = o.advanceAmount > 0 || isOrder ? await db.moneyReceipt.findMany({ where: { note: { startsWith: `${ADVANCE_NOTE_PREFIX}${o.number}` } }, orderBy: { date: "asc" } }) : []
  const summary = o.status === "converted" && o.customer && o.advanceAmount > 0 ? await customerDueSummary(ctx, db, o.customer.id) : null
  const kind = isOrder ? "order" : "quotation"

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/sales/orders", label: "Quotations & orders" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{o.number}</span>
            <OrderTypeBadge type={o.type} />
            <OrderStatusBadge status={o.status} expired={expired} />
          </span>
        }
        description={`${date(o.date)} · ${o.branch?.name ?? "—"}${o.createdBy ? ` · Prepared by ${o.createdBy}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/print/quotation/${o.id}`} target="_blank" rel="noopener">
                <Printer /> Print
              </a>
            </Button>
            {open && can(ctx, "sales.create") && (
              <Button variant="outline" asChild>
                <Link href={`/app/sales/orders/${o.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {open && isOrder && o.customer && can(ctx, "sales.receipt") && (
              <OrderAdvanceButton orderId={o.id} number={o.number} total={o.total} taken={o.advanceAmount} />
            )}
            {open && can(ctx, "sales.cancel") && (
              <ReasonDialogButton
                label={`Cancel ${kind}`}
                title={`Cancel ${o.number}?`}
                description={
                  o.advanceAmount > 0 ? (
                    <>
                      The {money(o.advanceAmount)} advance stays with {o.customer?.name} as an unapplied customer advance — it is not refunded automatically.
                      Refund it separately if the customer asks for the money back.
                    </>
                  ) : (
                    <>The {kind} is closed and can no longer be converted. Nothing else changes.</>
                  )
                }
                endpoint={`/api/v1/sales-orders/${o.id}/cancel`}
                confirmLabel={`Cancel ${kind}`}
                placeholder="e.g. Customer chose another design"
                successMessage={o.advanceAmount > 0 ? `${o.number} cancelled — ${money(o.advanceAmount)} kept as customer advance` : `${o.number} cancelled`}
              />
            )}
            {open && can(ctx, "sales.create") && (
              <Button asChild>
                <Link href={`/app/pos?fromOrder=${o.id}`}>
                  <ShoppingCart /> Convert to invoice
                </Link>
              </Button>
            )}
          </>
        }
      />

      {o.status === "cancelled" && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Cancelled {dateTime(o.cancelledAt)}</p>
            <p className="mt-0.5 text-muted-foreground">{o.cancelReason}</p>
            {o.advanceAmount > 0 && <p className="mt-1 text-xs text-muted-foreground">The {money(o.advanceAmount)} advance was kept as a customer advance.</p>}
          </div>
        </div>
      )}
      {o.status === "converted" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          <span>
            Converted to invoice{" "}
            {o.convertedInvoice ? (
              <Link href={`/app/sales/invoices/${o.convertedInvoice.id}`} className="num font-medium underline">
                {o.convertedInvoice.number}
              </Link>
            ) : (
              "—"
            )}
            .
          </span>
          {summary && summary.unappliedAdvance > 0 && summary.openInvoices.length > 0 && (
            <span className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                <WalletCards className="mr-1 inline size-3.5" />
                {money(summary.unappliedAdvance)} advance not yet applied
              </span>
              <ApplyAdvanceButton customerId={o.customer!.id} amount={summary.unappliedAdvance} totalDue={summary.totalDue} />
            </span>
          )}
        </div>
      )}
      {expired && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          This {kind} expired on {date(o.validUntil)}. Check prices before converting it.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <div className="border-b px-5 py-3.5">
            <h2 className="font-semibold">Items</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-right text-xs">Qty</TableHead>
                  <TableHead className="text-right text-xs">Price</TableHead>
                  <TableHead className="text-right text-xs">Discount</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  {open && <TableHead className="text-right text-xs">In stock</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="py-3">
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.variationName} · <span className="num">{l.sku}</span>
                      </p>
                    </TableCell>
                    <TableCell className="num text-right">
                      {quantity(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                    </TableCell>
                    <TableCell className="num text-right">{money(l.unitPrice)}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">{l.discount ? money(l.discount) : "—"}</TableCell>
                    <TableCell className="num text-right font-medium">{money(l.lineTotal)}</TableCell>
                    {open && <TableCell className={`num text-right ${l.stock < l.quantity ? "text-destructive" : "text-muted-foreground"}`}>{quantity(l.stock)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <dl className="ml-auto grid max-w-sm gap-1.5 border-t px-5 py-4 text-sm">
            <Line label="Subtotal" value={money(o.subtotal)} />
            {o.discount > 0 && <Line label="Discount" value={`− ${money(o.discount)}`} />}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="num">{money(o.total)}</dd>
            </div>
            {o.advanceAmount > 0 && <Line label="Advance received" value={money(o.advanceAmount)} />}
            {o.advanceAmount > 0 && <Line label="Balance on delivery" value={money(Math.max(o.total - o.advanceAmount, 0))} />}
          </dl>
          {o.note && <p className="border-t px-5 py-3 text-sm whitespace-pre-line text-muted-foreground">{o.note}</p>}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Customer</h2>
            {o.customer ? (
              <div className="mt-2 text-sm">
                <p className="font-medium">{o.customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {o.customer.code}
                  {o.customer.phone && ` · ${o.customer.phone}`}
                </p>
                {o.customer.address && <p className="mt-1 text-xs text-muted-foreground">{o.customer.address}</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No customer — the quotation is addressed to a walk-in buyer.</p>
            )}
            <dl className="mt-4 grid gap-1.5 border-t pt-3 text-sm">
              <Line label="Valid until" value={date(o.validUntil)} />
              <Line label="Created" value={dateTime(o.createdAt)} />
            </dl>
          </section>
          {advances.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">Advance receipts</h2>
              <ul className="mt-2 divide-y text-sm">
                {advances.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <Link href={`/app/sales/receipts/${a.id}`} className="num font-medium hover:underline">
                      {a.number}
                    </Link>
                    <span className={`num ${a.cancelledAt ? "text-muted-foreground line-through" : ""}`}>{money(Number(a.amount))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </PageBody>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  )
}
