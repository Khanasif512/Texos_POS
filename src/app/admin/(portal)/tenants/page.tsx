import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { TenantsTable } from "@/components/admin/tenants-table"
import { Button } from "@/components/ui/button"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"

export const metadata: Metadata = { title: "Tenants" }

export default async function TenantsPage() {
  await requireAdmin("/admin/tenants")
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscriptions: { where: { isCurrent: true }, include: { plan: true } }, _count: { select: { users: true, branches: true } } },
  })
  return (
    <PageBody>
      <PageHeader
        title="Tenants"
        description={`${companies.length} companies on the platform.`}
        actions={
          <Button asChild>
            <Link href="/admin/tenants/new">
              <Plus /> Create Tenants
            </Link>
          </Button>
        }
      />
      <TenantsTable
        rows={companies.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          status: c.status,
          plan: c.subscriptions[0]?.plan.name ?? "—",
          subStatus: c.subscriptions[0]?.status ?? "—",
          trialEndsAt: c.subscriptions[0]?.trialEndsAt?.toISOString() ?? null,
          users: c._count.users,
          branches: c._count.branches,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </PageBody>
  )
}
