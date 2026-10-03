import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StockDocForm } from "@/components/inventory/stock-doc-form"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { todayLocal } from "@/server/modules/inventory-ops/shared"

export const metadata: Metadata = { title: "New transfer" }

export default async function NewTransferPage() {
  const ctx = await requireTenant("/app/inventory/transfers/new")
  ensurePermission(ctx, "inventory.transfer")
  if (!ctx.plan.features.multiBranchTransfer) return <FeatureLocked title="New transfer" feature="Inter-branch transfer" planName={ctx.plan.name} />
  // destination may be any active branch of the company (not only the user's own)
  const destinations = await prisma.branch.findMany({
    where: { companyId: ctx.companyId, status: "active" },
    orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  })
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title="New branch transfer"
        description="Dispatching takes the goods out of the source branch now (oldest batches first) and carries their cost to the destination."
        back={{ href: "/app/inventory/transfers", label: "Branch transfers" }}
      />
      <StockDocForm mode="transfer" today={todayLocal()} destinations={destinations} />
    </PageBody>
  )
}
