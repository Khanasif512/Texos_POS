import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { DetailsCard, DocLines } from "@/components/inventory/doc-lines"
import { TransferActions } from "@/components/inventory/transfer-actions"
import { FeatureLocked } from "@/components/purchasing/feature-locked"
import { TransferStatusBadge } from "@/components/purchasing/status"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { getTransfer } from "@/server/modules/inventory-ops/service"
import { date, dateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Transfer" }

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/inventory/transfers/${id}`)
  ensurePermission(ctx, "inventory.transfer")
  if (!ctx.plan.features.multiBranchTransfer) return <FeatureLocked title="Transfer" feature="Inter-branch transfer" planName={ctx.plan.name} />
  const t = await getTransfer(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "FORBIDDEN") return null
    throw e
  })
  if (!t) notFound()
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        back={{ href: "/app/inventory/transfers", label: "Branch transfers" }}
        title={
          <span className="flex items-center gap-2">
            <span className="num">{t.number}</span>
            <TransferStatusBadge status={t.status} />
          </span>
        }
        description={
          <span className="flex items-center gap-1.5">
            {t.fromName} <ArrowRight className="size-3.5" /> {t.toName}
          </span>
        }
        actions={<TransferActions t={t} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Items</h2>
            <p className="text-xs text-muted-foreground">Unit cost is the weighted FIFO cost taken from the source branch.</p>
          </div>
          <DocLines lines={t.lines} showCost={t.showCost} total={t.value} />
        </section>
        <DetailsCard
          items={[
            { label: "Date", value: date(t.date) },
            { label: "From", value: t.fromName },
            { label: "To", value: t.toName },
            { label: "Dispatched by", value: t.createdBy ?? "—" },
            { label: "Dispatched", value: dateTime(t.createdAt) },
            ...(t.status === "completed" ? [{ label: "Received by", value: t.receivedBy ?? "—" }, { label: "Received", value: dateTime(t.receivedAt) }] : []),
            ...(t.note ? [{ label: "Note", value: t.note }] : []),
          ]}
        />
      </div>
    </PageBody>
  )
}
