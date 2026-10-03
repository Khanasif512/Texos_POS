import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { BillingClient } from "@/components/billing/billing-client"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { billingSummary } from "@/server/modules/platform/billing"

export const metadata: Metadata = { title: "Subscription & billing" }

/** §7 / TEN-05: works fully while the workspace is read-only — this is where a lapsed tenant pays. */
export default async function BillingPage() {
  const ctx = await requireTenant("/app/settings/billing")
  ensurePermission(ctx, "settings.billing")
  const summary = await billingSummary(ctx)
  return (
    <PageBody className="max-w-6xl">
      <PageHeader title="Subscription & billing" description={`Plan, usage and invoices for ${ctx.company.name}.`} />
      <BillingClient summary={summary} plan={{ name: ctx.plan.name, maxBranches: ctx.plan.maxBranches, maxEmployees: ctx.plan.maxEmployees, maxProducts: ctx.plan.maxProducts, features: ctx.plan.features }} readOnlyReason={ctx.readOnlyReason} />
    </PageBody>
  )
}
