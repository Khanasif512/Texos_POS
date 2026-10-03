import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { CostSheet } from "@/components/lc/cost-sheet"
import { LandedCostPanel } from "@/components/lc/landed-cost-panel"
import { LcActions } from "@/components/lc/lc-actions"
import { foreign, kg, rate } from "@/components/lc/lc-format"
import { LcLocked, LcStatusBadge, LcStepper } from "@/components/lc/lc-status"
import { LcTabs } from "@/components/lc/lc-tabs"
import { SnapshotHistory } from "@/components/lc/snapshot-history"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getLcDetail } from "@/server/modules/lc/service"
import { date, dateTime, money, quantity } from "@/lib/format"
import { BASIS_LABEL } from "@/lib/validation/lc"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "LC" }

export default async function LcDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/lc/${id}`)
  ensurePermission(ctx, "lc.view")
  if (!ctx.plan.features.lc)
    return (
      <PageBody>
        <PageHeader title="LC" />
        <LcLocked planName={ctx.plan.name} />
      </PageBody>
    )

  const lc = await getLcDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const current = lc.snapshots.find((s) => s.isCurrent) ?? null
  const landedTotal = current ? current.totalBaseCost + current.totalExtraCost : null

  const products = (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Product</th>
                <th className="px-3 py-2.5 text-right font-medium">Ordered</th>
                <th className="px-3 py-2.5 text-right font-medium">Received</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Unit wt.</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Total wt.</th>
                {lc.showCost && (
                  <>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Unit price</th>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Line value</th>
                    <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">Landed / unit</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lc.lines.map((l) => {
                const pct = l.quantity > 0 ? Math.min(100, (l.receivedQty / l.quantity) * 100) : 0
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.variationName} · {l.sku}
                      </p>
                    </td>
                    <td className="num px-3 py-3 text-right whitespace-nowrap">
                      {quantity(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className={cn("num", pct >= 100 ? "text-success" : pct > 0 ? "" : "text-muted-foreground")}>{quantity(l.receivedQty)}</p>
                      <div className="mt-1 ml-auto h-1 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="num px-3 py-3 text-right text-muted-foreground">{l.unitWeight > 0 ? kg(l.unitWeight) : "—"}</td>
                    <td className="num px-3 py-3 text-right">{l.unitWeight > 0 ? kg(l.unitWeight * l.quantity) : "—"}</td>
                    {lc.showCost && (
                      <>
                        <td className="num px-3 py-3 text-right whitespace-nowrap">{foreign(l.unitPriceForeign, lc.currency)}</td>
                        <td className="num px-3 py-3 text-right whitespace-nowrap">{foreign(l.lineValueForeign, lc.currency)}</td>
                        <td className="num px-4 py-3 text-right font-semibold whitespace-nowrap">
                          {l.landedUnitCost != null ? money(l.landedUnitCost) : <span className="text-xs font-normal text-muted-foreground">—</span>}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 text-sm font-medium">
                <td className="px-4 py-2.5">Total</td>
                <td className="num px-3 py-2.5 text-right">{quantity(lc.totals.quantity)}</td>
                <td />
                <td />
                <td className="num px-3 py-2.5 text-right">{kg(lc.totals.weight)}</td>
                {lc.showCost && (
                  <>
                    <td />
                    <td className="num px-3 py-2.5 text-right whitespace-nowrap">{foreign(lc.totals.valueForeign, lc.currency)}</td>
                    <td />
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">LC information</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              ["Supplier", `${lc.supplier.name}${lc.supplier.code ? ` (${lc.supplier.code})` : ""}`],
              ["Issuing bank", lc.issuingBank],
              ["Receiving branch", lc.branch.name],
              ["Currency", lc.currency],
              ["Distribution basis", BASIS_LABEL[lc.distributionBasis]],
              ["Opened", date(lc.openedDate)],
              ["Expected arrival", date(lc.expectedArrivalDate)],
              ["Actual arrival", date(lc.actualArrivalDate)],
              ["Finalized", lc.finalizedAt ? dateTime(lc.finalizedAt) : "—"],
              ["Created", dateTime(lc.createdAt)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">Notes</h3>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{lc.notes || "No notes."}</p>
        </section>
      </div>
    </div>
  )

  const tabs: { value: string; label: string; count?: number; content: ReactNode }[] = [{ value: "products", label: "Products", count: lc.lines.length, content: products }]
  if (lc.showCost) {
    tabs.push(
      {
        value: "costs",
        label: "Cost sheet",
        count: lc.costItems.length,
        content: (
          <CostSheet
            lcId={lc.id}
            status={lc.status}
            currency={lc.currency}
            exchangeRate={lc.exchangeRate}
            totalForeign={lc.totals.valueForeign}
            baseCost={lc.totals.baseCost}
            extraTotal={lc.totals.extraCost}
            items={lc.costItems}
          />
        ),
      },
      {
        value: "landed",
        label: "Landed cost",
        content: lc.preview && (
          <LandedCostPanel
            lcId={lc.id}
            status={lc.status}
            currency={lc.currency}
            exchangeRate={lc.exchangeRate}
            savedBasis={lc.distributionBasis}
            preview={lc.preview}
            lines={lc.lines.map((l) => ({ id: l.id, productName: l.productName, variationName: l.variationName, sku: l.sku, unit: l.unit }))}
            current={current && { version: current.version, basis: current.basis, createdAt: current.createdAt, createdBy: current.createdBy }}
            finalizedAt={lc.finalizedAt}
            costsChanged={lc.costsChanged}
          />
        ),
      },
      { value: "history", label: "History", count: lc.snapshots.length, content: <SnapshotHistory lcId={lc.id} rows={lc.snapshots} /> },
    )
  }

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/lc", label: "All LCs" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{lc.lcNumber}</span>
            <LcStatusBadge status={lc.status} className="text-xs" />
          </span>
        }
        description={`${lc.supplier.name} · ${lc.issuingBank} · ${lc.branch.name}`}
        actions={
          <LcActions
            lc={{ id: lc.id, lcNumber: lc.lcNumber, status: lc.status, openedDate: lc.openedDate, hasSnapshot: !!current, hasReceipts: lc.hasReceipts }}
          />
        }
      />

      <LcStepper
        status={lc.status}
        dates={{ opened: lc.openedDate, received: lc.actualArrivalDate, cost_finalized: lc.finalizedAt }}
      />

      {lc.costsChanged && current && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Costs changed since the current calculation (v{current.version})</p>
            <p className="text-muted-foreground">
              Cost items or the exchange rate differ from what v{current.version} used. Recalculate on the Landed cost tab (with a reason) to update
              stock valuation{lc.status === "cost_finalized" ? " and the supplier payable" : ""}.
            </p>
          </div>
        </div>
      )}

      {lc.showCost && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="LC value" value={foreign(lc.lcValue, lc.currency)} hint={`Lines ${foreign(lc.totals.valueForeign, lc.currency)}`} />
          <StatCard
            label="Exchange rate"
            value={lc.exchangeRate > 0 ? rate(lc.exchangeRate) : "—"}
            hint={`BDT per 1 ${lc.currency}`}
            tone={lc.exchangeRate > 0 ? "default" : "warning"}
          />
          <StatCard label="Product value (base)" value={lc.exchangeRate > 0 ? money(lc.totals.baseCost) : "—"} hint="Lines × rate" />
          <StatCard label="Extra costs" value={money(lc.totals.extraCost)} hint={`${lc.costItems.length} cost item(s)`} />
          <StatCard
            label="Landed total"
            value={landedTotal != null ? money(landedTotal) : "—"}
            hint={current ? `Calculation v${current.version}` : "Not calculated yet"}
            tone={landedTotal != null ? "success" : "default"}
          />
        </div>
      )}

      <LcTabs tabs={tabs} />
    </PageBody>
  )
}
