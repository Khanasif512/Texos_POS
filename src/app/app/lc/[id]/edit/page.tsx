import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { LcForm, LcLockedForm, type LcFormValue } from "@/components/lc/lc-form"
import { LcLocked } from "@/components/lc/lc-status"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getLcDetail } from "@/server/modules/lc/service"
import { linesEditable } from "@/lib/validation/lc"

export const metadata: Metadata = { title: "Edit LC" }

export default async function EditLcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/lc/${id}/edit`)
  ensurePermission(ctx, "lc.update")
  if (!ctx.plan.features.lc)
    return (
      <PageBody>
        <PageHeader title="Edit LC" />
        <LcLocked planName={ctx.plan.name} />
      </PageBody>
    )

  const lc = await getLcDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const value: LcFormValue = {
    id: lc.id,
    status: lc.status,
    supplier: { id: lc.supplier.id, code: lc.supplier.code, name: lc.supplier.name, country: lc.supplier.country, currency: lc.supplier.currency },
    lcNumber: lc.lcNumber,
    issuingBank: lc.issuingBank,
    branchId: lc.branch.id,
    currency: lc.currency,
    lcValue: lc.lcValue,
    exchangeRate: lc.exchangeRate,
    distributionBasis: lc.distributionBasis,
    openedDate: lc.openedDate,
    expectedArrivalDate: lc.expectedArrivalDate,
    actualArrivalDate: lc.actualArrivalDate,
    notes: lc.notes,
    lines: lc.lines.map((l) => ({
      id: l.id,
      quantity: l.quantity,
      unitWeight: l.unitWeight,
      unitPriceForeign: l.unitPriceForeign,
      variation: {
        id: l.variationId,
        productId: "",
        productName: l.productName,
        name: l.variationName,
        sku: l.sku,
        barcode: null,
        unit: l.unit,
        unitWeight: l.defaultUnitWeight,
        salePrice: 0,
        wholesalePrice: null,
        stock: 0,
      },
    })),
  }

  const editable = linesEditable(lc.status)
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title={`Edit ${lc.lcNumber}`}
        description={editable ? "Everything can be changed until the goods are received." : "Only the rate, basis, arrival date and notes can change now."}
        back={{ href: `/app/lc/${lc.id}`, label: lc.lcNumber }}
      />
      {editable ? <LcForm lc={value} /> : <LcLockedForm lc={value} />}
    </PageBody>
  )
}
