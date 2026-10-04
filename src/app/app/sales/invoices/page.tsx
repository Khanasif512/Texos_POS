import type { Metadata } from "next"
import type { Prisma } from "@/generated/prisma/client"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { InvoicesTable } from "@/components/sales/invoices-table"
import { branchFilter, can, ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { num } from "@/server/decimal"
import { dateRange, readListParams, type ListSearchParams } from "@/server/list"
import { invoiceScope } from "@/server/modules/sales/service"
import { money } from "@/lib/format"

export const metadata: Metadata = { title: "Invoices" }

const STATUSES = ["confirmed", "partially_returned", "returned", "cancelled"] as const
type Status = (typeof STATUSES)[number]

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/sales/invoices")
  ensurePermission(ctx, "sales.view")
  const p = readListParams(await searchParams, { sortable: ["invoiceDate", "number", "total", "dueAmount"], defaultSort: "invoiceDate:desc" })
  const viewAll = can(ctx, "sales.view_all")
  const type = p.get("type")
  const status = p.status
  const salesmanId = viewAll ? p.get("salesmanId") : undefined
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  let overdueBefore: Date | null = null
  if (p.get("overdue") === "1") {
    const c = await prisma.company.findUnique({ where: { id: ctx.companyId }, select: { settings: true } })
    const days = Number((c?.settings as { creditDueDays?: number } | null)?.creditDueDays) || 30
    overdueBefore = daysAgo(days)
  }

  const where: Prisma.InvoiceWhereInput = {
    companyId: ctx.companyId,
    AND: [
      branchFilter(ctx, branchId),
      invoiceScope(ctx),
      type === "cash" || type === "credit" ? { type } : {},
      status && STATUSES.includes(status as Status) ? { status: status as Status } : {},
      salesmanId ? { salesmanId } : {},
      overdueBefore ? { type: "credit", dueAmount: { gt: 0 }, invoiceDate: { lt: overdueBefore } } : {},
      p.from || p.to ? { invoiceDate: dateRange(p.from, p.to) } : {},
      p.q ? { OR: [{ number: { contains: p.q } }, { customerName: { contains: p.q } }, { customerPhone: { contains: p.q } }] } : {},
    ],
  }
  const live: Prisma.InvoiceWhereInput = { AND: [where, { status: { not: "cancelled" } }] }
  const [rows, total, sums, salesmen] = await Promise.all([
    prisma.invoice.findMany({ where, orderBy: [p.orderBy, { createdAt: "desc" }], skip: p.skip, take: p.take }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where: live, _sum: { total: true, paidAmount: true, dueAmount: true }, _count: { _all: true } }),
    prisma.user.findMany({ where: { companyId: ctx.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  const names = new Map(salesmen.map((s) => [s.id, s.name]))
  const codes = new Map(ctx.branches.map((b) => [b.id, b.code]))

  return (
    <PageBody>
      <PageHeader
        title="Invoices"
        description={viewAll ? "Every cash and credit sale across your branches." : "Sales you made or recorded."}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sales (filtered)" value={money(num(sums._sum.total))} hint={`${sums._count._all} invoices, excluding cancelled`} />
        <StatCard label="Collected" value={money(num(sums._sum.paidAmount))} tone="success" />
        <StatCard label="Outstanding" value={money(num(sums._sum.dueAmount))} tone={num(sums._sum.dueAmount) > 0 ? "danger" : "default"} />
      </div>
      <InvoicesTable
        rows={rows.map((r) => ({
          id: r.id,
          number: r.number,
          invoiceDate: r.invoiceDate.toISOString(),
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          hasCustomer: !!r.customerId,
          type: r.type,
          total: num(r.total),
          paidAmount: num(r.paidAmount),
          dueAmount: num(r.dueAmount),
          status: r.status,
          printCount: r.printCount,
          salesman: r.salesmanId ? (names.get(r.salesmanId) ?? "—") : null,
          branchCode: codes.get(r.branchId) ?? "",
        }))}
        total={total}
        page={p.page}
        limit={p.limit}
        salesmen={salesmen.map((s) => ({ id: s.id, name: s.name }))}
        showSalesmanFilter={viewAll}
      />
    </PageBody>
  )
}
