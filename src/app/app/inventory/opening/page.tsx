import type { Metadata } from "next"
import { History } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StockDocForm } from "@/components/inventory/stock-doc-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { recentOpeningEntries } from "@/server/modules/inventory-ops/service"
import { todayLocal } from "@/server/modules/inventory-ops/shared"
import { dateTime, money, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Opening stock" }

export default async function OpeningStockPage() {
  const ctx = await requireTenant("/app/inventory/opening")
  ensurePermission(ctx, "inventory.adjust")
  const recent = await recentOpeningEntries(ctx)
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title="Opening stock"
        description="Bring existing inventory into TexonPOS when you start. Each line creates an OPENING batch at the cost you enter, so FIFO costing and profit are right from day one."
      />
      <StockDocForm mode="opening" today={todayLocal()} />
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <History className="size-4 text-muted-foreground" />
          <h2 className="font-semibold">Recent opening entries</h2>
        </div>
        {recent.length ? (
          <ul className="divide-y">
            {recent.map((r) => (
              <li key={`${r.refId}-${r.branchName}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{r.branchName}</p>
                  <p className="text-xs text-muted-foreground">{dateTime(r.at)}</p>
                </div>
                <div className="flex gap-6 text-right">
                  <span className="text-muted-foreground">{r.lines} item(s)</span>
                  <span className="num">{quantity(r.units)} units</span>
                  {r.value != null && <span className="num font-medium">{money(r.value)}</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No opening stock posted yet.</p>
        )}
      </section>
    </PageBody>
  )
}
