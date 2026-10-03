import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { ReceiptsTable } from "@/components/purchasing/receipts-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { readListParams, type ListSearchParams } from "@/server/list"
import { GRN_SORTABLE, listGoodsReceipts } from "@/server/modules/purchasing/queries"

export const metadata: Metadata = { title: "Goods receipts" }

export default async function GoodsReceiptsPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/purchases/receipts")
  ensurePermission(ctx, "purchase.view")
  if (!ctx.plan.features.purchase) return <FeatureLocked title="Goods receipts" feature="Purchasing" planName={ctx.plan.name} />
  const p = readListParams(await searchParams, { sortable: GRN_SORTABLE, defaultSort: "date:desc" })
  const source = p.get("source")
  const { rows, total, showCost } = await listGoodsReceipts(ctx, { ...p, source })
  return (
    <PageBody>
      <PageHeader title="Goods receipts" description="Every receipt of purchased or imported goods into a branch, with the batch cost it created." />
      <ReceiptsTable rows={rows} total={total} page={p.page} limit={p.limit} showCost={showCost} filtered={!!(p.q || source || p.branchId || p.from || p.to)} />
    </PageBody>
  )
}
