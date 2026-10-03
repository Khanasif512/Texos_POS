import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StockTable } from "@/components/inventory/stock-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { readListParams, type ListSearchParams } from "@/server/list"
import { STOCK_SORTABLE, stockOverview, stockSummary } from "@/server/modules/inventory-ops/queries"
import { integer, money, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Stock by branch" }

export default async function StockPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/inventory")
  ensurePermission(ctx, "inventory.view")
  const p = readListParams(await searchParams, { sortable: STOCK_SORTABLE, defaultSort: "product:asc" })
  const stock = p.get("stock")
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const [res, summary] = await Promise.all([stockOverview(ctx, { ...p, branchId, stock }), stockSummary(ctx, branchId)])
  const scope = branchId ? ctx.branches.find((b) => b.id === branchId)?.name : ctx.allBranches ? "Company-wide" : "Your branches"
  return (
    <PageBody>
      <PageHeader
        title="Stock by branch"
        description={`${scope} · balances are derived from the stock ledger; costs come from FIFO batches.`}
        actions={
          summary.lowCount > 0 && (
            <Button variant="outline" asChild>
              <Link href={`/app/inventory/low-stock${branchId ? `?branchId=${branchId}` : ""}`}>
                <AlertTriangle className="text-warning" /> {summary.lowCount} low-stock alert{summary.lowCount === 1 ? "" : "s"}
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Units on hand" value={quantity(summary.units)} hint={scope} />
        <StatCard label="Items in stock" value={integer(summary.skusInStock)} hint="Variations with quantity > 0" />
        {summary.value != null && <StatCard label="Stock value at cost" value={money(summary.value)} hint="Σ available batch qty × unit cost" />}
        <StatCard label="Low-stock alerts" value={integer(summary.lowCount)} tone={summary.lowCount > 0 ? "warning" : "default"} hint="At or below reorder level" />
      </div>
      <StockTable
        rows={res.rows}
        total={res.total}
        page={p.page}
        limit={p.limit}
        branches={res.branches}
        showCost={res.showCost}
        filtered={!!(p.q || stock)}
      />
    </PageBody>
  )
}
