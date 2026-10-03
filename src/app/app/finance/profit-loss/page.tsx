import type { Metadata } from "next"
import Link from "next/link"
import { Lock } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { ProfitLossClient } from "@/components/finance/profit-loss-client"
import { branchFilter, ensurePermission, requireTenant } from "@/server/auth/context"
import { dayKey, monthKeysOfYear, resolvePeriod } from "@/server/modules/finance/calc"
import { pnlByBranch, pnlPeriods, pnlStatement } from "@/server/modules/finance/pnl"

export const metadata: Metadata = { title: "Profit & loss" }

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireTenant("/app/finance/profit-loss")
  ensurePermission(ctx, "finance.view")
  if (!ctx.plan.features.advancedReports)
    return (
      <PageBody>
        <PageHeader title="Profit & loss" />
        <EmptyState
          icon={Lock}
          title="Profit & loss is part of Advanced reports"
          text={`Your ${ctx.plan.name} plan doesn't include advanced reports. Upgrade to see daily and monthly P&L by branch.`}
          action={
            <Button asChild>
              <Link href="/app/settings/billing">See plans</Link>
            </Button>
          }
        />
      </PageBody>
    )
  const sp = await searchParams
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined))
  const period = resolvePeriod(get, dayKey(new Date()))
  const requested = get("branchId")
  const f = branchFilter(ctx, requested && ctx.branchIds.includes(requested) ? requested : null)
  const branchIds = typeof f.branchId === "string" ? [f.branchId] : f.branchId.in
  const scope = { companyId: ctx.companyId, branchIds }
  const [statement, byBranch, monthly] = await Promise.all([
    pnlStatement({ ...scope, from: period.from, to: period.to }),
    pnlByBranch({ ...scope, from: period.from, to: period.to }, ctx.branches),
    pnlPeriods({ ...scope, from: `${period.year}-01-01`, to: `${period.year}-12-31` }, "month", monthKeysOfYear(period.year)),
  ])
  return (
    <PageBody>
      <PageHeader
        title="Profit & loss"
        description="Revenue from invoices less returns, cost of goods from snapshotted landed costs, and operating expenses. LC-allocated expenses sit in landed cost, not here."
      />
      <ProfitLossClient period={period} statement={statement} byBranch={byBranch} monthly={monthly} />
    </PageBody>
  )
}
