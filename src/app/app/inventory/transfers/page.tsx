import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { TransfersTable } from "@/components/inventory/transfers-table"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listTransfers, TRF_SORTABLE } from "@/server/modules/inventory-ops/queries"

export const metadata: Metadata = { title: "Branch transfers" }

export default async function TransfersPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/inventory/transfers")
  ensurePermission(ctx, "inventory.transfer")
  if (!ctx.plan.features.multiBranchTransfer) return <FeatureLocked title="Branch transfers" feature="Inter-branch transfer" planName={ctx.plan.name} />
  const p = readListParams(await searchParams, { sortable: TRF_SORTABLE, defaultSort: "date:desc" })
  const direction = p.get("direction")
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const { rows, total, showCost } = await listTransfers(ctx, { ...p, branchId, direction })
  return (
    <PageBody>
      <PageHeader title="Branch transfers" description="Stock leaves the source branch on dispatch and arrives when the destination confirms receipt." />
      <TransfersTable
        rows={rows}
        total={total}
        page={p.page}
        limit={p.limit}
        showCost={showCost}
        filtered={!!(p.q || p.status || direction || branchId || p.from || p.to)}
      />
    </PageBody>
  )
}
