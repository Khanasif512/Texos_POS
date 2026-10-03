import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Layers } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { StockLedgerTable } from "@/components/inventory/stock-ledger-table"
import { SOURCE_LABEL } from "@/components/purchasing/status"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { readListParams, type ListSearchParams } from "@/server/list"
import { stockCard } from "@/server/modules/inventory-ops/queries"
import { date, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Stock card" }

export default async function StockCardPage({ params, searchParams }: { params: Promise<{ variationId: string }>; searchParams: Promise<ListSearchParams> }) {
  const { variationId } = await params
  const ctx = await requireTenant(`/app/inventory/${variationId}`)
  ensurePermission(ctx, "inventory.view")
  const sp = await searchParams
  const p = readListParams(sp, { defaultSort: "createdAt:desc", pageSize: 25 })
  const allBatches = p.get("batches") === "all"
  const card = await stockCard(ctx, variationId, { ...p, type: p.get("type"), allBatches }).catch((e) => {
    if (e instanceof AppError && e.code === "FORBIDDEN") return null
    throw e
  })
  if (!card) notFound()
  const v = card.variation
  const toggle = new URLSearchParams(Object.entries(sp).flatMap(([k, val]) => (typeof val === "string" ? [[k, val]] : [])))
  if (allBatches) toggle.delete("batches")
  else toggle.set("batches", "all")

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/inventory", label: "Stock by branch" }}
        title={`${v.productName} — ${v.name}`}
        description={
          <span className="num">
            SKU {v.sku}
            {v.barcode ? ` · barcode ${v.barcode}` : ""} · sells at {money(v.salePrice)} / {v.unit}
          </span>
        }
        actions={
          <Link href={`/app/products/${v.productId}`} className="text-sm font-medium text-primary hover:underline">
            Product details
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="On hand (your branches)" value={`${quantity(card.total)} ${v.unit}`} hint={v.reorderLevel > 0 ? `Reorder at ${quantity(v.reorderLevel)} per branch` : "No reorder level set"} />
        {card.value != null && <StatCard label="Value at cost" value={money(card.value)} hint={card.total > 0 ? `Avg ${money(card.value / card.total)} / ${v.unit}` : undefined} />}
        {card.balances.map((b) => {
          const low = v.reorderLevel > 0 && b.quantity <= v.reorderLevel
          return (
            <StatCard
              key={b.branchId}
              label={b.branchName}
              value={quantity(b.quantity)}
              tone={low ? (b.quantity <= 0 ? "danger" : "warning") : "default"}
              hint={low ? "At or below reorder level" : undefined}
            />
          )
        })}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <h2 className="font-semibold">{allBatches ? "All batches" : "Available batches"}</h2>
            <span className="text-xs text-muted-foreground">FIFO order — oldest is sold first</span>
          </div>
          <Link href={`?${toggle.toString()}`} scroll={false} className="text-xs font-medium text-primary hover:underline">
            {allBatches ? "Show available only" : "Include depleted batches"}
          </Link>
        </div>
        {card.batches.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Batch</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Branch</th>
                  <th className="px-3 py-2.5 font-medium">Received</th>
                  <th className="px-3 py-2.5 text-right font-medium">Received qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Available</th>
                  {card.showCost && <th className="px-5 py-2.5 text-right font-medium">Unit cost</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {card.batches.map((b) => (
                  <tr key={b.id} className={cn(b.qtyAvailable <= 0 && "text-muted-foreground")}>
                    <td className="num px-5 py-2.5 font-medium">{b.batchNo}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={b.source === "lc" ? "primary" : b.source === "purchase" ? "info" : "neutral"}>{SOURCE_LABEL[b.source] ?? b.source}</StatusBadge>
                      {b.lcNumber && (
                        <Link href={`/app/lc/${b.lcId}`} className="num ml-2 text-xs hover:underline">
                          {b.lcNumber}
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{b.branchName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{date(b.receivedAt)}</td>
                    <td className="num px-3 py-2.5 text-right">{quantity(b.qtyReceived)}</td>
                    <td className="num px-3 py-2.5 text-right font-medium">{quantity(b.qtyAvailable)}</td>
                    {card.showCost && <td className="num px-5 py-2.5 text-right">{money(b.unitCost)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No stock batches{allBatches ? "" : " with quantity available"}.</p>
        )}
      </section>

      <div className="space-y-3">
        <h2 className="font-semibold">Stock ledger</h2>
        <StockLedgerTable rows={card.ledger} total={card.ledgerTotal} page={p.page} limit={p.limit} showCost={card.showCost} />
      </div>
    </PageBody>
  )
}
