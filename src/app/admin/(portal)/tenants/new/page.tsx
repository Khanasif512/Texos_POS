import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { CreateTenantForm } from "@/components/admin/create-tenant-form"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"

export const metadata: Metadata = { title: "Create tenant" }

export default async function NewTenantPage() {
  await requireAdmin("/admin/tenants/new")
  const plans = await prisma.plan.findMany({
    where: { status: "active" },
    orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
    select: { code: true, name: true, isDefaultTrial: true },
  })

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/admin/tenants", label: "Tenants" }}
        title="Create Tenant"
        description="Create a company workspace and its owner account."
      />
      <CreateTenantForm plans={plans} />
    </PageBody>
  )
}