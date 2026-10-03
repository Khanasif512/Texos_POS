import Link from "next/link"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { MrrChart, PlanDistribution } from "@/components/admin/overview-charts"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"
import { billingOverview, platformOverview } from "@/server/modules/platform/service"
import { date, money } from "@/lib/format"

export default async function AdminOverviewPage() {
  await requireAdmin()
  const [o, b, recent] = await Promise.all([
    platformOverview(),
    billingOverview(),
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { subscriptions: { where: { isCurrent: true }, include: { plan: true } } },
    }),
  ])
  const kpis = [
    { label: "Monthly recurring revenue", value: money(o.mrr), hint: `${o.paying} paying companies` },
    { label: "Revenue this month", value: money(b.revenueThisMonth), hint: `${b.paymentsThisMonth} payment${b.paymentsThisMonth === 1 ? "" : "s"} confirmed` },
    {
      label: "Outstanding invoices",
      value: money(b.outstandingAmount),
      hint: `${b.outstandingCount} unpaid${b.overdueCount ? ` · ${b.overdueCount} overdue` : ""}`,
      href: "/admin/billing?status=unpaid",
    },
    { label: "Tenants", value: String(o.companies), hint: `${o.trialing} in trial · ${o.newCompanies} new in 30 days` },
    { label: "Trial → paid", value: `${o.conversion.toFixed(1)}%`, hint: `${o.converted} of ${o.decided} decided trials converted` },
    { label: "Churn (30 days)", value: `${o.churnRate.toFixed(1)}%`, hint: `${o.churned} paying compan${o.churned === 1 ? "y" : "ies"} lost` },
  ]
  return (
    <PageBody>
      <PageHeader title="Platform overview" description="Health of the TexonPOS SaaS business." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => {
          const body = (
            <>
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <p className="num mt-2 text-2xl font-semibold">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
            </>
          )
          return k.href ? (
            <Link key={k.label} href={k.href} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
              {body}
            </Link>
          ) : (
            <div key={k.label} className="rounded-xl border bg-card p-5">
              {body}
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">MRR trend</h2>
          <p className="mb-4 text-xs text-muted-foreground">Last 12 months, from paid invoices (yearly plans spread monthly).</p>
          <MrrChart data={b.mrrTrend} />
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold">Plan distribution</h2>
          <PlanDistribution rows={b.planDistribution} />
        </section>
      </div>

      {b.retention.length > 0 && (
        <section className="rounded-xl border border-destructive/30 bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <AlertTriangle className="size-4 text-destructive" />
            <h2 className="font-semibold">Retention period ended</h2>
            <span className="text-xs text-muted-foreground">Cancelled over 90 days ago — eligible for deletion (NFR-CMP-02). Data is kept until you act.</span>
          </div>
          <ul className="divide-y text-sm">
            {b.retention.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/tenants/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/40">
                  <span className="min-w-0 flex-1 font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">Cancelled {date(c.cancelledAt)}</span>
                  <span className="text-xs text-muted-foreground">Retention ended {date(c.retentionEndedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Newest tenants</h2>
          <Link href="/admin/tenants" className="flex items-center gap-1 text-sm text-primary hover:underline">
            All tenants <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <ul className="divide-y">
          {recent.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/tenants/${c.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                </div>
                <span className="hidden text-sm text-muted-foreground sm:block">{c.subscriptions[0]?.plan.name ?? "—"}</span>
                <StatusBadge tone={c.status === "active" ? "success" : c.status === "trial" ? "info" : "danger"}>{c.status}</StatusBadge>
                <span className="hidden w-28 text-right text-xs text-muted-foreground md:block">{date(c.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageBody>
  )
}
