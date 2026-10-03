import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"
import { platformOverview } from "@/server/modules/platform/service"
import { date, money } from "@/lib/format"

export default async function AdminOverviewPage() {
  await requireAdmin()
  const [o, recent] = await Promise.all([
    platformOverview(),
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { subscriptions: { where: { isCurrent: true }, include: { plan: true } } },
    }),
  ])
  const kpis = [
    { label: "Monthly recurring revenue", value: money(o.mrr), hint: `${o.paying} paying companies` },
    { label: "Tenants", value: String(o.companies), hint: `${o.newCompanies} new in last 30 days` },
    { label: "In trial", value: String(o.trialing), hint: `${o.users} active users platform-wide` },
    { label: "Trial → paid", value: `${o.conversion.toFixed(1)}%`, hint: `Churn (30d): ${o.churnRate.toFixed(1)}%` },
  ]
  return (
    <PageBody>
      <PageHeader title="Platform overview" description="Health of the TexonPOS SaaS business." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="num mt-2 text-2xl font-semibold">{k.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </div>
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
