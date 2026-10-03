import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FileText, PackageOpen, Ship } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { ReceiveForm } from "@/components/purchasing/receive-form"
import { PoStatusBadge } from "@/components/purchasing/status"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { lcReceivable, poReceivable } from "@/server/modules/purchasing/service"
import { openReceiptSources } from "@/server/modules/purchasing/queries"
import { todayLocal } from "@/server/modules/inventory-ops/shared"
import { date } from "@/lib/format"

export const metadata: Metadata = { title: "Receive goods" }

const orNull = <T,>(p: Promise<T>) =>
  p.catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null
    throw e
  })

export default async function ReceiveGoodsPage({ searchParams }: { searchParams: Promise<{ poId?: string; lcId?: string }> }) {
  const sp = await searchParams
  const ctx = await requireTenant("/app/purchases/receipts/new")
  ensurePermission(ctx, "purchase.receive")
  if (!ctx.plan.features.purchase) return <FeatureLocked title="Receive goods" feature="Purchasing" planName={ctx.plan.name} />
  const back = { href: "/app/purchases/receipts", label: "Goods receipts" }
  const today = todayLocal()

  if (sp.poId) {
    const po = await orNull(poReceivable(ctx, sp.poId))
    if (!po) notFound()
    const blocked = po.status === "cancelled" ? "This purchase order is cancelled." : null
    return (
      <PageBody className="max-w-6xl">
        <PageHeader
          back={{ href: `/app/purchases/${po.id}`, label: po.number }}
          title={`Receive ${po.number}`}
          description={`${po.supplier.name} · ordered for ${po.branchName}. Partial receipts are fine — receive the rest later.`}
        />
        <ReceiveForm
          source="po"
          sourceId={po.id}
          sourceLabel={po.number}
          defaultBranchId={po.branchId}
          showCost={po.showCost}
          today={today}
          blocked={blocked}
          lines={po.lines.map((l) => ({ ...l, unitCost: l.unitPriceBdt }))}
        />
      </PageBody>
    )
  }

  if (sp.lcId) {
    if (!ctx.plan.features.lc) return <FeatureLocked title="Receive LC goods" feature="LC management" planName={ctx.plan.name} />
    const lc = await orNull(lcReceivable(ctx, sp.lcId))
    if (!lc) notFound()
    return (
      <PageBody className="max-w-6xl">
        <PageHeader
          back={{ href: `/app/lc/${lc.id}`, label: lc.lcNumber }}
          title={`Receive LC ${lc.lcNumber}`}
          description={`${lc.supplierName} · goods enter stock at landed cost${lc.snapshotVersion ? ` (calculation v${lc.snapshotVersion})` : ""}.`}
        />
        <ReceiveForm
          source="lc"
          sourceId={lc.id}
          sourceLabel={`LC ${lc.lcNumber}`}
          defaultBranchId={lc.branchId}
          showCost={lc.showCost}
          today={today}
          blocked={lc.blocked}
          lines={lc.lines}
        />
      </PageBody>
    )
  }

  const { pos, lcs } = await openReceiptSources(ctx)
  return (
    <PageBody className="max-w-5xl">
      <PageHeader back={back} title="Receive goods" description="Choose what arrived: a local purchase order or an imported LC." />
      {pos.length === 0 && lcs.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Nothing waiting to be received"
          text="Open purchase orders and LCs marked as received (with landed cost calculated) appear here."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <FileText className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Open purchase orders</h2>
            </div>
            {pos.length ? (
              <ul className="divide-y">
                {pos.map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/purchases/receipts/new?poId=${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="num text-sm font-medium">{p.number}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.supplierName} · {p.branchName} · {date(p.orderDate)}
                        </p>
                      </div>
                      <PoStatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No open purchase orders.</p>
            )}
          </section>
          {ctx.plan.features.lc && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-5 py-4">
                <Ship className="size-4 text-muted-foreground" />
                <h2 className="font-semibold">LCs ready to receive</h2>
              </div>
              {lcs.length ? (
                <ul className="divide-y">
                  {lcs.map((l) => (
                    <li key={l.id}>
                      <Link href={`/app/purchases/receipts/new?lcId=${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="num text-sm font-medium">{l.lcNumber}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {l.supplierName} · {l.branchName}
                          </p>
                        </div>
                        {l.hasSnapshot ? (
                          <StatusBadge tone="success">Landed cost ready</StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">Calculate cost first</StatusBadge>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No received LCs with open quantities.</p>
              )}
            </section>
          )}
        </div>
      )}
    </PageBody>
  )
}
