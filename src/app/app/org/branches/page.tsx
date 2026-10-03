import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { BranchesClient } from "@/components/org/branches-client"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"

export const metadata: Metadata = { title: "Branches" }

export default async function BranchesPage() {
  const ctx = await requireTenant("/app/org/branches")
  ensurePermission(ctx, "org.branches")
  const db = tenantDb(ctx.companyId)
  const branches = await db.branch.findMany({
    orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  })
  const active = branches.filter((b) => b.status === "active").length
  return (
    <PageBody>
      <PageHeader
        title="Branches"
        description={`Showrooms and warehouses. ${active} of ${ctx.plan.maxBranches} active branches used on the ${ctx.plan.name} plan.`}
      />
      <BranchesClient
        canAdd={active < ctx.plan.maxBranches}
        rows={branches.map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          address: b.address,
          phone: b.phone,
          status: b.status,
          isHeadOffice: b.isHeadOffice,
          staff: b._count.users,
        }))}
      />
    </PageBody>
  )
}
