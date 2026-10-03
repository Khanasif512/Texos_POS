import type { Metadata } from "next"
import Link from "next/link"
import { PackageCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { PurchaseOrdersTable } from "@/components/purchasing/purchase-orders-table"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listPurchaseOrders, PO_SORTABLE } from "@/server/modules/purchasing/queries"

export const metadata: Metadata = { title: "Purchase orders" }

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/purchases")
  ensurePermission(ctx, "purchase.view")
  if (!ctx.plan.features.purchase) return <FeatureLocked title="Purchase orders" feature="Purchasing" planName={ctx.plan.name} />
  const p = readListParams(await searchParams, { sortable: PO_SORTABLE, defaultSort: "orderDate:desc" })
  const { rows, total, showCost } = await listPurchaseOrders(ctx, p)
  return (
    <PageBody>
      <PageHeader
        title="Purchase orders"
        description="Local purchases from suppliers in BDT (optionally referencing an LC). Receive them fully or in parts."
        actions={
          can(ctx, "purchase.receive") && (
            <Button variant="outline" asChild>
              <Link href="/app/purchases/receipts/new">
                <PackageCheck /> Receive goods
              </Link>
            </Button>
          )
        }
      />
      <PurchaseOrdersTable
        rows={rows}
        total={total}
        page={p.page}
        limit={p.limit}
        showCost={showCost}
        filtered={!!(p.q || p.status || p.branchId || p.from || p.to)}
      />
    </PageBody>
  )
}
