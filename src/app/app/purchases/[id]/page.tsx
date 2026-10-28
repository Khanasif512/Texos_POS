import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PackageCheck } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { PoActions } from "@/components/purchasing/po-actions"
import { PoStatusBadge } from "@/components/purchasing/status"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { getPurchaseOrder } from "@/server/modules/purchasing/service"
import { amount, date, dateTime, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Purchase order" }

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/purchases/${id}`)
  ensurePermission(ctx, "purchase.view")
  if (!ctx.plan.features.purchase) return <FeatureLocked title="Purchase order" feature="Purchasing" planName={ctx.plan.name} />
  const po = await getPurchaseOrder(ctx, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null
    throw e
  })
  if (!po) notFound()
  const ordered = po.lines.reduce((a, l) => a + l.quantity, 0)
  const received = po.lines.reduce((a, l) => a + l.receivedQty, 0)
  const cancelled = po.lines.reduce((a, l) => a + l.cancelledQty, 0)
  const remaining = po.lines.reduce((a, l) => a + l.remaining, 0)
  const foreign = po.currency !== "BDT"
  const info = [
    { label: "Supplier", value: <Link href={`/app/suppliers/${po.supplier.id}`} className="font-medium hover:underline">{po.supplier.name}</Link> },
    { label: "Receiving branch", value: po.branchName },
    { label: "Order date", value: date(po.orderDate) },
    { label: "Expected delivery", value: po.expectedDate ? date(po.expectedDate) : "—" },
    { label: "Currency", value: foreign ? `${po.currency} @ ৳${po.exchangeRate}` : "BDT" },
    { label: "Invoice reference", value: po.invoiceReference || "—" },
    ...(po.bankDetails ? [{ label: "Bank details", value: <span className="whitespace-pre-line">{po.bankDetails}</span> }] : []),
    ...(po.lc ? [{ label: "Linked LC", value: <Link href={`/app/lc/${po.lc.id}`} className="num hover:underline">{po.lc.lcNumber}</Link> }] : []),
  ]

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/purchases", label: "Purchase orders" }}
        title={
          <span className="flex items-center gap-2">
            <span className="num">{po.number}</span>
            <PoStatusBadge status={po.status} />
          </span>
        }
        description={`Created ${dateTime(po.createdAt)}`}
        actions={<PoActions po={{ id: po.id, number: po.number, status: po.status, editable: po.editable, partial: received > 0 }} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ordered" value={quantity(ordered)} hint={`${po.lines.length} item(s)`} />
        <StatCard label="Received" value={quantity(received)} tone={received > 0 ? "success" : "default"} hint={`${po.receipts.length} receipt(s)`} />
        <StatCard label="Still to receive" value={quantity(remaining)} tone={remaining > 0 ? "warning" : "default"} hint={cancelled > 0 ? `${quantity(cancelled)} cancelled` : undefined} />
        {po.totalBdt != null && <StatCard label="Order value" value={money(po.totalBdt)} hint={foreign ? `${po.currency} ${amount(po.totalForeign)}` : "Local purchase"} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 text-right font-medium">Ordered</th>
                  <th className="px-3 py-2.5 text-right font-medium">Received</th>
                  <th className="px-3 py-2.5 text-right font-medium">Remaining</th>
                  {po.showCost && <th className="px-3 py-2.5 text-right font-medium">Unit price</th>}
                  {po.showCost && <th className="px-5 py-2.5 text-right font-medium">Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {po.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3">
                      <Link href={`/app/inventory/${l.variationId}`} className="font-medium hover:underline">
                        {l.productName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {l.variationName} · {l.sku}
                      </p>
                    </td>
                    <td className="num px-3 py-3 text-right">
                      {quantity(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                    </td>
                    <td className={cn("num px-3 py-3 text-right", l.receivedQty > 0 && "text-success")}>{quantity(l.receivedQty)}</td>
                    <td className="num px-3 py-3 text-right">
                      {quantity(l.remaining)}
                      {l.cancelledQty > 0 && <p className="text-xs text-muted-foreground">{quantity(l.cancelledQty)} cancelled</p>}
                    </td>
                    {po.showCost && (
                      <td className="num px-3 py-3 text-right">
                        {money(l.unitPriceBdt)}
                        {foreign && l.unitPriceForeign != null && (
                          <p className="text-xs text-muted-foreground">
                            {po.currency} {amount(l.unitPriceForeign)}
                          </p>
                        )}
                      </td>
                    )}
                    {po.showCost && <td className="num px-5 py-3 text-right font-medium">{money(l.lineTotal)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Details</h2>
            </div>
            <dl className="space-y-3 p-5 text-sm">
              {info.map((i) => (
                <div key={i.label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{i.label}</dt>
                  <dd className="text-right">{i.value}</dd>
                </div>
              ))}
              {po.notes && (
                <div className="border-t pt-3">
                  <dt className="mb-1 text-xs text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-line">{po.notes}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <PackageCheck className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Goods receipts</h2>
            </div>
            {po.receipts.length ? (
              <ul className="divide-y">
                {po.receipts.map((r) => (
                  <li key={r.id}>
                    <Link href={`/app/purchases/receipts/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                      <div>
                        <p className="num text-sm font-medium">{r.number}</p>
                        <p className="text-xs text-muted-foreground">
                          {date(r.date)} · {r.branchName}
                        </p>
                      </div>
                      <span className="num text-sm">{quantity(r.quantity)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing received yet.</p>
            )}
          </section>
        </div>
      </div>
    </PageBody>
  )
}
