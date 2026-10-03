import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Ban, Printer, ShieldAlert, Truck, Undo2, Wallet } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ChallanStatusBadge, InvoiceStatusBadge, InvoiceTypeBadge, PrintStatusBadge } from "@/components/sales/badges"
import { CancelInvoiceButton } from "@/components/sales/cancel-invoice"
import { ChallanActions } from "@/components/sales/challan-actions"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { getInvoiceDetail } from "@/server/modules/sales/queries"
import { date, dateTime, money, quantity } from "@/lib/format"
import { PAYMENT_METHOD_LABEL } from "@/lib/validation/sales"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Invoice" }

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/sales/invoices/${id}`)
  ensurePermission(ctx, "sales.view")
  const inv = await getInvoiceDetail(ctx, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const showCost = inv.costTotal !== null
  const cancelled = inv.status === "cancelled"
  const live = !cancelled && inv.status !== "returned"
  const firstChallan = inv.challans[0]

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/sales/invoices", label: "Invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{inv.number}</span>
            <InvoiceTypeBadge type={inv.type} />
            <InvoiceStatusBadge status={inv.status} />
          </span>
        }
        description={`${dateTime(inv.createdAt)} · ${inv.branch.name}${inv.salesman ? ` · Sold by ${inv.salesman.name}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/print/invoice/${inv.id}`} target="_blank" rel="noopener">
                <Printer /> Print invoice
              </a>
            </Button>
            {firstChallan && (
              <Button variant="outline" asChild>
                <a href={`/print/challan/${firstChallan.id}`} target="_blank" rel="noopener">
                  <Truck /> Print challan
                </a>
              </Button>
            )}
            {live && inv.dueAmount > 0 && inv.customer && can(ctx, "sales.receipt") && (
              <Button variant="outline" asChild>
                <Link href={`/app/sales/receipts/new?invoiceId=${inv.id}`}>
                  <Wallet /> Record payment
                </Link>
              </Button>
            )}
            {live && can(ctx, "sales.return") && (
              <Button variant="outline" asChild>
                <Link href={`/app/sales/returns/new?invoiceId=${inv.id}`}>
                  <Undo2 /> Return items
                </Link>
              </Button>
            )}
            {!cancelled && can(ctx, "sales.cancel") && (
              <CancelInvoiceButton id={inv.id} number={inv.number} total={inv.total} paid={inv.paidAmount} blockers={inv.cancelBlockers} />
            )}
          </>
        }
      />

      {cancelled && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Cancelled {dateTime(inv.cancelledAt)} by {inv.cancelledBy ?? "—"}</p>
            <p className="mt-0.5 text-muted-foreground">{inv.cancelReason}</p>
            <p className="mt-1 text-xs text-muted-foreground">Stock was returned to its batches and the customer ledger reversed.</p>
          </div>
        </div>
      )}
      {inv.creditOverrideBy && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <ShieldAlert className="size-4 text-warning" /> Credit limit was overridden by {inv.creditOverrideBy}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-hidden rounded-xl border bg-card">
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
                    {showCost && <TableHead className="text-right text-xs">Unit cost</TableHead>}
                    {showCost && <TableHead className="text-right text-xs">Profit</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="py-3">
                        <p className="font-medium">{l.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.variationName} · <span className="num">{l.sku}</span>
                          {l.returnedQty > 0 && <span className="ml-1 text-warning">· {quantity(l.returnedQty)} returned</span>}
                        </p>
                      </TableCell>
                      <TableCell className="num text-right">
                        {quantity(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                      </TableCell>
                      <TableCell className="num text-right">{money(l.unitPrice)}</TableCell>
                      <TableCell className="num text-right text-muted-foreground">{l.discount ? money(l.discount) : "—"}</TableCell>
                      <TableCell className="num text-right font-medium">{money(l.lineTotal)}</TableCell>
                      {showCost && <TableCell className="num text-right text-muted-foreground">{money(l.unitCost)}</TableCell>}
                      {showCost && (
                        <TableCell className={cn("num text-right", (l.profit ?? 0) < 0 ? "text-destructive" : "text-success")}>{money(l.profit)}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                {showCost && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right text-xs text-muted-foreground">
                        Cost of goods {money(inv.costTotal)} · Gross profit (after invoice discount)
                      </TableCell>
                      <TableCell colSpan={2} className={cn("num text-right font-semibold", (inv.profit ?? 0) < 0 ? "text-destructive" : "text-success")}>
                        {money(inv.profit)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
            <dl className="ml-auto grid max-w-sm gap-1.5 border-t px-5 py-4 text-sm">
              <Line label="Subtotal" value={money(inv.subtotal)} />
              {inv.discount > 0 && <Line label="Discount" value={`− ${money(inv.discount)}`} />}
              {inv.tax > 0 && <Line label="VAT / tax" value={money(inv.tax)} />}
              {inv.deliveryCharge > 0 && <Line label="Delivery charge" value={money(inv.deliveryCharge)} />}
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="num">{money(inv.total)}</dd>
              </div>
              <Line label={`Paid${inv.paymentMethod ? ` (${PAYMENT_METHOD_LABEL[inv.paymentMethod]})` : ""}`} value={money(inv.paidAmount)} />
              {inv.returnedAmount > 0 && <Line label="Returned" value={money(inv.returnedAmount)} />}
              <div className={cn("flex justify-between font-medium", inv.dueAmount > 0 && !cancelled && "text-destructive")}>
                <dt>Due</dt>
                <dd className="num">{money(inv.dueAmount)}</dd>
              </div>
            </dl>
            {inv.note && <p className="border-t px-5 py-3 text-sm text-muted-foreground">Note: {inv.note}</p>}
          </section>

          <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="font-semibold">Challans</h2>
              <Link href="/app/sales/challans" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                All challans
              </Link>
            </div>
            {inv.challans.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No challan.</p>
            ) : (
              <ul className="divide-y">
                {inv.challans.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="num font-medium">{c.number}</span>
                        <ChallanStatusBadge status={c.status} />
                        <PrintStatusBadge count={c.printCount} />
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[c.deliveryAddress, c.deliveryPerson && `by ${c.deliveryPerson}`, c.vehicleNo, c.deliveredAt && `delivered ${date(c.deliveredAt)}`]
                          .filter(Boolean)
                          .join(" · ") || "No delivery details yet"}
                      </p>
                    </div>
                    <ChallanActions challan={{ ...c, invoiceCancelled: cancelled }} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Customer</h2>
            {inv.customer ? (
              <div className="mt-2 space-y-1 text-sm">
                <Link href={`/app/customers/${inv.customer.id}`} className="font-medium hover:underline">
                  {inv.customer.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  <span className="num">{inv.customer.code}</span> · <span className="capitalize">{inv.customer.type}</span>
                </p>
                {inv.customer.phone && <p className="num">{inv.customer.phone}</p>}
                {inv.customer.address && <p className="text-muted-foreground">{inv.customer.address}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Current balance</p>
                    <p className={cn("num font-semibold", inv.customer.balance > 0 && "text-destructive")}>{money(inv.customer.balance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Credit limit</p>
                    <p className="num font-semibold">{money(inv.customer.creditLimit)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm">
                <p className="font-medium">{inv.customerName || "Walk-in customer"}</p>
                {inv.customerPhone && <p className="num text-muted-foreground">{inv.customerPhone}</p>}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Details</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <Line label="Branch" value={inv.branch.name} />
              <Line label="Salesman" value={inv.salesman?.name ?? "—"} />
              <Line label="Recorded by" value={inv.createdBy ?? "—"} />
              <Line label="Invoice date" value={date(inv.invoiceDate)} />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Print status</dt>
                <dd>
                  <PrintStatusBadge count={inv.printCount} />
                </dd>
              </div>
              {!cancelled && inv.status === "confirmed" && (
                <Line label="Cancellable until" value={inv.cancelBlockers.length ? "—" : dateTime(inv.cancelDeadline)} />
              )}
              {inv.salesOrderId && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">From order</dt>
                  <dd>
                    <Link href={`/app/sales/orders/${inv.salesOrderId}`} className="text-primary hover:underline">
                      View order
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3.5 text-sm font-semibold">Payments</h2>
            {inv.receipts.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                {inv.type === "cash" && inv.paidAmount > 0
                  ? `Paid in full at the counter (${PAYMENT_METHOD_LABEL[inv.paymentMethod ?? "cash"]}).`
                  : "No payments recorded."}
              </p>
            ) : (
              <ul className="divide-y">
                {inv.receipts.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="num font-medium">
                        {r.number} {r.cancelled && <StatusBadge tone="danger">Cancelled</StatusBadge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {date(r.date)} · {PAYMENT_METHOD_LABEL[r.method] ?? r.method}
                        {r.reference && ` · ${r.reference}`}
                      </p>
                    </div>
                    <span className={cn("num font-medium", r.cancelled && "text-muted-foreground line-through")}>{money(r.allocated)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3.5 text-sm font-semibold">Print history</h2>
            {inv.printLogs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Not printed yet.</p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto">
                {inv.printLogs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs">
                    <span>
                      <span className="capitalize">{p.docType}</span> <span className="num text-muted-foreground">{p.docNumber}</span>
                    </span>
                    <span className="text-right text-muted-foreground">
                      {p.user ?? "—"} · {dateTime(p.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PageBody>
  )
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num text-right">{value}</dd>
    </div>
  )
}
