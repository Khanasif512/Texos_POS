import type { Metadata } from "next"
import type { Prisma } from "@/generated/prisma/client"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ChallansTable } from "@/components/sales/challans-table"
import { branchFilter, ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { dateRange, readListParams, type ListSearchParams } from "@/server/list"

export const metadata: Metadata = { title: "Challans" }

export default async function ChallansPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/sales/challans")
  ensurePermission(ctx, "delivery.view", "sales.view")
  const p = readListParams(await searchParams, { sortable: ["createdAt", "number", "deliveryDate"], defaultSort: "createdAt:desc" })
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const base: Prisma.ChallanWhereInput = {
    companyId: ctx.companyId,
    AND: [
      branchFilter(ctx, branchId),
      p.from || p.to ? { createdAt: dateRange(p.from, p.to) } : {},
      p.q
        ? {
            OR: [
              { number: { contains: p.q } },
              { deliveryPerson: { contains: p.q } },
              { invoice: { number: { contains: p.q } } },
              { invoice: { customerName: { contains: p.q } } },
              { invoice: { customerPhone: { contains: p.q } } },
            ],
          }
        : {},
    ],
  }
  const where: Prisma.ChallanWhereInput =
    p.status === "pending" || p.status === "delivered" ? { AND: [base, { status: p.status }] } : base
  const [rows, total, byStatus] = await Promise.all([
    prisma.challan.findMany({
      where,
      orderBy: [p.orderBy, { createdAt: "desc" }],
      skip: p.skip,
      take: p.take,
      include: { invoice: { select: { id: true, number: true, status: true, customerName: true, customerPhone: true } } },
    }),
    prisma.challan.count({ where }),
    prisma.challan.groupBy({ by: ["status"], where: { AND: [base, { invoice: { status: { not: "cancelled" } } }] }, _count: { _all: true } }),
  ])
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0
  const codes = new Map(ctx.branches.map((b) => [b.id, b.code]))

  return (
    <PageBody>
      <PageHeader title="Challans" description="Delivery notes for every invoice — assign delivery, mark delivered and reprint." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Awaiting delivery" value={count("pending")} tone={count("pending") > 0 ? "warning" : "default"} hint="Pending challans (excl. cancelled invoices)" />
        <StatCard label="Delivered" value={count("delivered")} tone="success" />
      </div>
      <ChallansTable
        rows={rows.map((c) => ({
          id: c.id,
          number: c.number,
          status: c.status,
          deliveryAddress: c.deliveryAddress,
          deliveryPerson: c.deliveryPerson,
          deliveryPhone: c.deliveryPhone,
          vehicleNo: c.vehicleNo,
          deliveryDate: c.deliveryDate?.toISOString() ?? null,
          deliveredAt: c.deliveredAt?.toISOString() ?? null,
          showPrices: c.showPrices,
          note: c.note,
          printCount: c.printCount,
          createdAt: c.createdAt.toISOString(),
          branchCode: codes.get(c.branchId) ?? "",
          invoiceId: c.invoice.id,
          invoiceNumber: c.invoice.number,
          invoiceStatus: c.invoice.status,
          invoiceCancelled: c.invoice.status === "cancelled",
          customerName: c.invoice.customerName,
          customerPhone: c.invoice.customerPhone,
        }))}
        total={total}
        page={p.page}
        limit={p.limit}
      />
    </PageBody>
  )
}
