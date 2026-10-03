import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmployeesClient } from "@/components/org/employees-client"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"

export const metadata: Metadata = { title: "Employees" }

export default async function EmployeesPage() {
  const ctx = await requireTenant("/app/org/employees")
  ensurePermission(ctx, "org.employees")
  const db = tenantDb(ctx.companyId)
  const [users, roles, branches] = await Promise.all([
    db.user.findMany({ orderBy: [{ isOwner: "desc" }, { name: "asc" }], include: { role: true, branches: true } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, key: true } }),
    db.branch.findMany({ where: { status: "active" }, orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }], select: { id: true, name: true, code: true } }),
  ])
  const active = users.filter((u) => u.status === "active").length
  return (
    <PageBody>
      <PageHeader
        title="Employees"
        description={`People who can sign in to ${ctx.company.name}. ${active} of ${ctx.plan.maxEmployees} seats used.`}
      />
      <EmployeesClient
        currentUserId={ctx.userId}
        canAdd={active < ctx.plan.maxEmployees}
        roles={roles.filter((r) => r.key !== "owner")}
        branches={branches}
        rows={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          roleId: u.roleId,
          roleName: u.role.name,
          isOwner: u.isOwner,
          allBranches: u.allBranches,
          branchIds: u.branches.map((b) => b.branchId),
          employeeCode: u.employeeCode,
          designation: u.designation,
          joiningDate: u.joiningDate ? u.joiningDate.toISOString().slice(0, 10) : null,
          salary: u.salary ? Number(u.salary) : null,
          status: u.status,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </PageBody>
  )
}
