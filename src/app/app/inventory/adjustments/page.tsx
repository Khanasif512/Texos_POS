import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { AdjustmentsTable } from "@/components/inventory/adjustments-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { readListParams, type ListSearchParams } from "@/server/list"
import { ADJ_SORTABLE, listAdjustments } from "@/server/modules/inventory-ops/queries"

export const metadata: Metadata = { title: "Stock adjustments" }

export default async function AdjustmentsPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/inventory/adjustments")
  ensurePermission(ctx, "inventory.adjust")
  const p = readListParams(await searchParams, { sortable: ADJ_SORTABLE, defaultSort: "date:desc" })
  const reason = p.get("reason")
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const { rows, total, showCost } = await listAdjustments(ctx, { ...p, branchId, reason })
  return (
    <PageBody>
      <PageHeader title="Stock adjustments" description="Damage, count corrections, expired, lost and found stock — each with a reason code (INV-05)." />
      <AdjustmentsTable rows={rows} total={total} page={p.page} limit={p.limit} showCost={showCost} filtered={!!(p.q || reason || branchId || p.from || p.to)} />
    </PageBody>
  )
}
