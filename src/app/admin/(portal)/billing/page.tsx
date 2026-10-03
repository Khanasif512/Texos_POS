import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { BillingInvoicesTable } from "@/components/admin/billing-invoices-table"
import { RunJobsButton } from "@/components/admin/run-jobs-button"
import { StatCard } from "@/components/shared/stat-card"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"
import { num } from "@/server/decimal"
import { dateRange, readListParams, type ListSearchParams } from "@/server/list"
import { money } from "@/lib/format"
import type { Prisma } from "@/generated/prisma/client"

export const metadata: Metadata = { title: "Billing" }

const STATUSES = ["unpaid", "paid", "failed", "void"] as const

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  await requireAdmin("/admin/billing")
  const sp = await searchParams
  const p = readListParams(sp, { sortable: ["issuedAt", "amount", "dueAt", "number"], defaultSort: "issuedAt:desc" })
  const companyId = p.get("companyId")
  const where: Prisma.BillingInvoiceWhereInput = {
    ...(p.status && (STATUSES as readonly string[]).includes(p.status) ? { status: p.status as (typeof STATUSES)[number] } : {}),
    ...(companyId ? { companyId } : {}),
    ...(dateRange(p.from, p.to) ? { issuedAt: dateRange(p.from, p.to) } : {}),
    ...(p.q ? { OR: [{ number: { contains: p.q } }, { description: { contains: p.q } }, { paymentReference: { contains: p.q } }, { company: { name: { contains: p.q } } }] } : {}),
  }
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [rows, total, companies, plans, unpaid, overdue, collected, awaiting] = await Promise.all([
    prisma.billingInvoice.findMany({ where, orderBy: p.orderBy, skip: p.skip, take: p.take, include: { company: { select: { id: true, name: true } } } }),
    prisma.billingInvoice.count({ where }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.plan.findMany({ where: { status: "active" }, orderBy: { sortOrder: "asc" } }),
    prisma.billingInvoice.aggregate({ where: { status: "unpaid" }, _sum: { amount: true }, _count: true }),
    prisma.billingInvoice.aggregate({ where: { status: "unpaid", dueAt: { lt: now } }, _sum: { amount: true }, _count: true }),
    prisma.billingInvoice.aggregate({ where: { status: "paid", paidAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.billingInvoice.count({ where: { status: "unpaid", paymentReference: { not: null } } }),
  ])

  return (
    <PageBody>
      <PageHeader title="Billing" description="Subscription invoices across all tenants. Confirm manual payments here." actions={<RunJobsButton />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding" value={money(unpaid._sum.amount)} hint={`${unpaid._count} unpaid invoice${unpaid._count === 1 ? "" : "s"}`} />
        <StatCard label="Overdue" value={money(overdue._sum.amount)} hint={`${overdue._count} past due date`} tone={overdue._count ? "danger" : "default"} />
        <StatCard label="Awaiting confirmation" value={String(awaiting)} hint="Tenant sent a payment reference" tone={awaiting ? "warning" : "default"} />
        <StatCard label="Collected this month" value={money(collected._sum.amount)} hint={`${collected._count} payment${collected._count === 1 ? "" : "s"}`} tone="success" />
      </div>
      <BillingInvoicesTable
        rows={rows.map((r) => ({
          id: r.id,
          number: r.number,
          description: r.description,
          amount: num(r.amount),
          status: r.status,
          issuedAt: r.issuedAt.toISOString(),
          dueAt: r.dueAt?.toISOString() ?? null,
          paidAt: r.paidAt?.toISOString() ?? null,
          paymentReference: r.paymentReference,
          company: r.company,
        }))}
        total={total}
        page={p.page}
        limit={p.limit}
        companies={companies}
        plans={plans.map((pl) => ({ id: pl.id, name: pl.name, priceMonthly: num(pl.priceMonthly), priceYearly: num(pl.priceYearly) }))}
      />
    </PageBody>
  )
}
