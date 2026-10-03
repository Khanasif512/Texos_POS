import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { todayLocal } from "@/server/modules/inventory-ops/shared"

export const metadata: Metadata = { title: "New purchase order" }

export default async function NewPurchaseOrderPage() {
  const ctx = await requireTenant("/app/purchases/new")
  ensurePermission(ctx, "purchase.create")
  if (!ctx.plan.features.purchase) return <FeatureLocked title="New purchase order" feature="Purchasing" planName={ctx.plan.name} />
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title="New purchase order"
        description="Order from a local supplier. Stock and the supplier payable are posted when you receive the goods."
        back={{ href: "/app/purchases", label: "Purchase orders" }}
      />
      <PurchaseOrderForm today={todayLocal()} />
    </PageBody>
  )
}
