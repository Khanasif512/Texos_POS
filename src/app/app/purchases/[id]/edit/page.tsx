import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { getPurchaseOrder } from "@/server/modules/purchasing/service"
import { todayLocal, variationOptions } from "@/server/modules/inventory-ops/shared"

export const metadata: Metadata = { title: "Edit purchase order" }

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/purchases/${id}/edit`)
  ensurePermission(ctx, "purchase.update")
  if (!ctx.plan.features.purchase) return <FeatureLocked title="Edit purchase order" feature="Purchasing" planName={ctx.plan.name} />
  const po = await getPurchaseOrder(ctx, id).catch(() => null)
  if (!po) notFound()
  if (!po.editable) redirect(`/app/purchases/${id}`)
  const opts = await variationOptions(ctx, po.lines.map((l) => l.variationId), po.branchId)
  const foreign = po.currency !== "BDT"
  return (
    <PageBody className="max-w-6xl">
      <PageHeader title={`Edit ${po.number}`} description="Pending orders can be changed until the first goods arrive." back={{ href: `/app/purchases/${id}`, label: po.number }} />
      <PurchaseOrderForm
        today={todayLocal()}
        initial={{
          id: po.id,
          number: po.number,
          supplier: { id: po.supplier.id, code: po.supplier.code, name: po.supplier.name, country: po.supplier.country, currency: po.supplier.currency },
          lc: po.lc ? { id: po.lc.id, lcNumber: po.lc.lcNumber, status: po.lc.status, supplierName: "" } : null,
          branchId: po.branchId,
          orderDate: po.orderDate,
          expectedDate: po.expectedDate,
          currency: po.currency,
          exchangeRate: po.exchangeRate,
          notes: po.notes,
          lines: po.lines.flatMap((l) => {
            const variation = opts.get(l.variationId)
            if (!variation) return []
            return [{ variation, quantity: l.quantity, unitPrice: (foreign ? l.unitPriceForeign : l.unitPriceBdt) ?? 0 }]
          }),
        }}
      />
    </PageBody>
  )
}
