import type { Metadata } from "next"
import { Lock } from "lucide-react"
import Link from "next/link"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { DeliveryChargesClient } from "@/components/finance/delivery-charges-client"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { readListParams, type ListSearchParams } from "@/server/list"
import { deliveryChargeWhere } from "@/server/modules/finance/expenses"
import { deliveryTotalsByLc, listExpenses } from "@/server/modules/finance/queries"

export const metadata: Metadata = { title: "Delivery charges" }

export default async function DeliveryChargesPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/lc/delivery-charges")
  ensurePermission(ctx, "delivery.manage", "lc.update")
  if (!ctx.plan.features.lc)
    return (
      <PageBody>
        <PageHeader title="Delivery charges" />
        <EmptyState
          icon={Lock}
          title="LC management is not in your plan"
          text="Delivery charges are recorded against LCs. Upgrade to a plan with the LC & landed-cost engine to use them."
          action={
            <Button asChild>
              <Link href="/app/settings/billing">See plans</Link>
            </Button>
          }
        />
      </PageBody>
    )
  const sp = await searchParams
  const p = readListParams(sp, { sortable: ["date", "amount", "number"], defaultSort: "date:desc", pageSize: 20 })
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const lcId = p.get("lcId") || undefined
  const [list, byLc] = await Promise.all([
    listExpenses(
      ctx,
      { q: p.q, branchId, from: p.from, to: p.to, lcId: lcId === "all" ? undefined : lcId, skip: p.skip, take: p.take, orderBy: p.orderBy },
      await deliveryChargeWhere(ctx.companyId),
    ),
    deliveryTotalsByLc(ctx, { branchId, from: p.from, to: p.to }),
  ])
  return (
    <PageBody>
      <PageHeader
        title="Delivery charges"
        description="Record delivery and carrying costs against an LC. Each entry is booked as a “Delivery Charge” expense and added to the LC's cost items for landed-cost calculation."
        back={{ href: "/app/lc", label: "LC management" }}
      />
      <DeliveryChargesClient
        rows={list.rows}
        total={list.total}
        sum={list.totals.amount}
        page={p.page}
        limit={p.limit}
        byLc={byLc}
        canDelete={can(ctx, "delivery.manage") || can(ctx, "lc.update")}
      />
    </PageBody>
  )
}
