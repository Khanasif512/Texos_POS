import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { LowStockTable } from "@/components/inventory/low-stock-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { readListParams, type ListSearchParams } from "@/server/list"
import { lowStock } from "@/server/modules/inventory-ops/queries"

export const metadata: Metadata = { title: "Low stock" }

export default async function LowStockPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/inventory/low-stock")
  ensurePermission(ctx, "inventory.view")
  const p = readListParams(await searchParams, { defaultSort: "createdAt:desc", pageSize: 25 })
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const { rows, total } = await lowStock(ctx, { ...p, branchId })
  return (
    <PageBody>
      <PageHeader title="Low stock" description="Items whose balance in a branch is at or below the variation's reorder level, most urgent first." />
      <LowStockTable rows={rows} total={total} page={p.page} limit={p.limit} />
    </PageBody>
  )
}
