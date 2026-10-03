import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { CashClosingClient } from "@/components/finance/cash-closing-client"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { closingHistory } from "@/server/modules/finance/cash-closing"
import { dayKey, isDayKey } from "@/server/modules/finance/calc"

export const metadata: Metadata = { title: "Daily cash closing" }

export default async function CashClosingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireTenant("/app/finance/cash-closing")
  ensurePermission(ctx, "finance.cash_closing", "finance.view")
  const sp = await searchParams
  const branchId = sp.branchId && ctx.branchIds.includes(sp.branchId) ? sp.branchId : ctx.activeBranchId
  const date = isDayKey(sp.date) ? sp.date : dayKey(new Date())
  const history = await closingHistory(ctx, null, 30)
  return (
    <PageBody>
      <PageHeader
        title="Daily cash closing"
        description="Opening cash + cash sales + cash receipts − cash expenses − cash payouts = expected cash. Count the drawer and close the day."
      />
      <CashClosingClient
        initialBranchId={branchId}
        initialDate={date}
        history={history}
        canClose={can(ctx, "finance.cash_closing")}
        isOwner={ctx.isOwner}
      />
    </PageBody>
  )
}
