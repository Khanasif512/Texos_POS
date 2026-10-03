import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { LcLocked } from "@/components/lc/lc-status"
import { LcTable } from "@/components/lc/lc-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { canSeeLcCost, listLcs } from "@/server/modules/lc/service"

export const metadata: Metadata = { title: "LC management" }

export default async function LcListPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/lc")
  ensurePermission(ctx, "lc.view")
  if (!ctx.plan.features.lc)
    return (
      <PageBody>
        <PageHeader title="LC management" />
        <LcLocked planName={ctx.plan.name} />
      </PageBody>
    )

  const db = tenantDb(ctx.companyId)
  const p = readListParams(await searchParams, {
    sortable: ["createdAt", "lcNumber", "expectedArrivalDate", "status"],
    defaultSort: "createdAt:desc",
  })
  const [{ rows, total }, suppliers, byStatus] = await Promise.all([
    listLcs(ctx, db, { q: p.q, status: p.status, supplierId: p.get("supplierId"), branchId: p.branchId, skip: p.skip, take: p.take, orderBy: p.orderBy }),
    db.supplier.findMany({ where: { lcs: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.lc.groupBy({ by: ["status"], where: { branchId: { in: ctx.branchIds } }, _count: { _all: true } }),
  ])
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0

  return (
    <PageBody>
      <PageHeader title="LC management" description="Letters of credit, their import costs and the landed cost per unit." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open (draft → opened)" value={count("draft") + count("opened")} hint={`${count("draft")} draft`} />
        <StatCard label="Goods in transit" value={count("goods_in_transit")} hint="Awaiting arrival" />
        <StatCard
          label="Awaiting cost finalization"
          value={count("received")}
          tone={count("received") > 0 ? "warning" : "default"}
          hint="Received, landed cost not final"
        />
        <StatCard label="Finalized / closed" value={count("cost_finalized") + count("closed")} hint={`${count("closed")} closed`} />
      </div>
      <LcTable rows={rows} total={total} page={p.page} limit={p.limit} suppliers={suppliers} showCost={canSeeLcCost(ctx)} />
    </PageBody>
  )
}
