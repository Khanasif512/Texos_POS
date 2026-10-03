import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { DetailsCard, DocLines } from "@/components/inventory/doc-lines"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { getAdjustment } from "@/server/modules/inventory-ops/service"
import { date, dateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Stock adjustment" }

export default async function AdjustmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/inventory/adjustments/${id}`)
  ensurePermission(ctx, "inventory.adjust", "inventory.view")
  const a = await getAdjustment(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "FORBIDDEN") return null
    throw e
  })
  if (!a) notFound()
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        back={{ href: "/app/inventory/adjustments", label: "Stock adjustments" }}
        title={
          <span className="flex items-center gap-2">
            <span className="num">{a.number}</span>
            <StatusBadge tone="warning">{a.reasonLabel}</StatusBadge>
          </span>
        }
        description={a.note ?? undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Lines</h2>
          </div>
          <DocLines lines={a.lines} showCost={a.showCost} signed total={a.netValue} />
        </section>
        <DetailsCard
          items={[
            { label: "Date", value: date(a.date) },
            { label: "Branch", value: a.branchName },
            { label: "Reason", value: a.reasonLabel },
            { label: "Posted by", value: a.createdBy ?? "—" },
            { label: "Posted", value: dateTime(a.createdAt) },
          ]}
        />
      </div>
    </PageBody>
  )
}
