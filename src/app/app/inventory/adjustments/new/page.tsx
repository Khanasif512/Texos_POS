import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StockDocForm } from "@/components/inventory/stock-doc-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { todayLocal } from "@/server/modules/inventory-ops/shared"

export const metadata: Metadata = { title: "New stock adjustment" }

export default async function NewAdjustmentPage() {
  const ctx = await requireTenant("/app/inventory/adjustments/new")
  ensurePermission(ctx, "inventory.adjust")
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title="New stock adjustment"
        description="Removals take stock from the oldest batches first; additions create a batch at the cost you enter (or the last known cost)."
        back={{ href: "/app/inventory/adjustments", label: "Stock adjustments" }}
      />
      <StockDocForm mode="adjustment" today={todayLocal()} />
    </PageBody>
  )
}
