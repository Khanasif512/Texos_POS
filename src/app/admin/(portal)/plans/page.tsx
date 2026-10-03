import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { PlansClient } from "@/components/admin/plans-client"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"
import { num } from "@/server/decimal"

export const metadata: Metadata = { title: "Plans" }

export default async function AdminPlansPage() {
  await requireAdmin("/admin/plans")
  const [plans, counts] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }] }),
    prisma.subscription.groupBy({ by: ["planId"], where: { isCurrent: true }, _count: true }),
  ])
  const tenants = new Map(counts.map((c) => [c.planId, c._count]))
  return (
    <PageBody>
      <PageHeader title="Plans" description="Limits and feature flags apply to every tenant on a plan immediately (TEN-03)." />
      <PlansClient
        rows={plans.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          tagline: p.tagline,
          priceMonthly: num(p.priceMonthly),
          priceYearly: num(p.priceYearly),
          maxBranches: p.maxBranches,
          maxEmployees: p.maxEmployees,
          maxProducts: p.maxProducts,
          features: (p.features ?? {}) as Record<string, boolean>,
          isPublic: p.isPublic,
          isDefaultTrial: p.isDefaultTrial,
          sortOrder: p.sortOrder,
          status: p.status,
          tenants: tenants.get(p.id) ?? 0,
        }))}
      />
    </PageBody>
  )
}
