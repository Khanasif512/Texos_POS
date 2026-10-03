import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { RolesClient } from "@/components/org/roles-client"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"

export const metadata: Metadata = { title: "Roles & permissions" }

export default async function RolesPage() {
  const ctx = await requireTenant("/app/org/roles")
  ensurePermission(ctx, "org.roles")
  const roles = await tenantDb(ctx.companyId).role.findMany({
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    include: { permissions: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
  })
  return (
    <PageBody>
      <PageHeader
        title="Roles & permissions"
        description="Control what each role can see and do. Changes apply on the employee's next page load."
      />
      <RolesClient
        roles={roles.map((r) => ({
          id: r.id,
          key: r.key,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          users: r._count.users,
          permissions: r.permissions.map((p) => p.permission.key),
        }))}
      />
    </PageBody>
  )
}
