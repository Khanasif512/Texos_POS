import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { OrderForm, type OrderDraft } from "@/components/sales-after/order-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getOrder } from "@/server/modules/sales-after/orders"

export const metadata: Metadata = { title: "Edit order" }

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/sales/orders/${id}/edit`)
  ensurePermission(ctx, "sales.create")
  const o = await getOrder(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  if (o.status !== "open") redirect(`/app/sales/orders/${id}`)
  const draft: OrderDraft = {
    id: o.id,
    number: o.number,
    type: o.type,
    branchId: o.branch?.id ?? ctx.activeBranchId,
    customer: o.customer,
    date: o.date,
    validUntil: o.validUntil ?? "",
    discount: o.discount ? String(o.discount) : "",
    note: o.note ?? "",
    advanceAmount: o.advanceAmount,
    lines: o.lines.map((l) => ({
      key: l.id,
      variation: {
        id: l.variationId,
        productId: l.productId,
        productName: l.productName,
        name: l.variationName,
        sku: l.sku,
        barcode: l.barcode,
        unit: l.unit,
        unitWeight: l.unitWeight,
        salePrice: l.salePrice,
        wholesalePrice: l.wholesalePrice,
        stock: l.stock,
      },
      quantity: String(l.quantity),
      unitPrice: String(l.unitPrice),
      discount: l.discount ? String(l.discount) : "",
    })),
  }
  return (
    <PageBody>
      <PageHeader back={{ href: `/app/sales/orders/${id}`, label: o.number }} title={`Edit ${o.type === "order" ? "order" : "quotation"} ${o.number}`} />
      <OrderForm initial={draft} />
    </PageBody>
  )
}
