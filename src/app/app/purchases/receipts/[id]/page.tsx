import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { getGoodsReceipt } from "@/server/modules/purchasing/service"
import { date, dateTime, money, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Goods receipt" }

export default async function GoodsReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/purchases/receipts/${id}`)
  ensurePermission(ctx, "purchase.view")
  if (!ctx.plan.features.purchase) return <FeatureLocked title="Goods receipt" feature="Purchasing" planName={ctx.plan.name} />
  const r = await getGoodsReceipt(ctx, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null
    throw e
  })
  if (!r) notFound()
  const units = r.lines.reduce((a, l) => a + l.quantity, 0)
  const info = [
    { label: "Date", value: date(r.date) },
    { label: "Branch", value: r.branchName },
    { label: "Supplier", value: r.supplierName },
    {
      label: r.lc ? "LC" : "Purchase order",
      value: r.lc ? (
        <Link href={`/app/lc/${r.lc.id}`} className="num hover:underline">
          {r.lc.lcNumber}
        </Link>
      ) : r.po ? (
        <Link href={`/app/purchases/${r.po.id}`} className="num hover:underline">
          {r.po.number}
        </Link>
      ) : (
        "—"
      ),
    },
    { label: "Received by", value: r.createdBy ?? "—" },
    { label: "Posted", value: dateTime(r.createdAt) },
  ]
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        back={{ href: "/app/purchases/receipts", label: "Goods receipts" }}
        title={
          <span className="flex items-center gap-2">
            <span className="num">{r.number}</span>
            <StatusBadge tone={r.lc ? "primary" : "info"}>{r.lc ? "LC import" : "Local purchase"}</StatusBadge>
          </span>
        }
        description={r.note ?? undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Items received</h2>
            <p className="text-xs text-muted-foreground">Each line created a stock batch numbered {r.number}.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                  {r.showCost && <th className="px-3 py-2.5 text-right font-medium">{r.lc ? "Landed unit cost" : "Unit cost"}</th>}
                  {r.showCost && <th className="px-5 py-2.5 text-right font-medium">Value</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.lines.map((l) => (
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
                    {r.showCost && <td className="num px-3 py-3 text-right">{money(l.unitCost)}</td>}
                    {r.showCost && <td className="num px-5 py-3 text-right font-medium">{money(l.lineTotal)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-semibold">
                  <td className="px-5 py-3">Total</td>
                  <td className="num px-3 py-3 text-right">{quantity(units)}</td>
                  {r.showCost && <td />}
                  {r.showCost && <td className="num px-5 py-3 text-right">{money(r.total)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        <section className="h-fit rounded-xl border bg-card">
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
          </dl>
        </section>
      </div>
    </PageBody>
  )
}
