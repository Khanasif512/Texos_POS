import { notFound } from "next/navigation"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { TenantActions } from "@/components/admin/tenant-actions"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"
import { date, dateTime } from "@/lib/format"

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin(`/admin/tenants/${id}`)
  const [c, plans, logs] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        subscriptions: { where: { isCurrent: true }, include: { plan: true } },
        branches: { orderBy: { createdAt: "asc" } },
        users: { orderBy: { createdAt: "asc" }, include: { role: true } },
      },
    }),
    prisma.plan.findMany({ where: { status: "active" }, orderBy: { sortOrder: "asc" } }),
    prisma.auditLog.findMany({ where: { companyId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ])
  if (!c) notFound()
  const sub = c.subscriptions[0]
  return (
    <PageBody>
      <PageHeader
        back={{ href: "/admin/tenants", label: "Tenants" }}
        title={c.name}
        description={`${c.email} · joined ${date(c.createdAt)}`}
        actions={<StatusBadge tone={c.status === "active" ? "success" : c.status === "trial" ? "info" : "danger"}>{c.status}</StatusBadge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="mt-1 font-semibold">{sub?.plan.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subscription</p>
              <p className="mt-1 font-semibold capitalize">{sub?.status.replace("_", " ") ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{sub?.status === "trialing" ? "Trial ends" : "Period ends"}</p>
              <p className="mt-1 font-semibold">{date(sub?.status === "trialing" ? sub.trialEndsAt : sub?.currentPeriodEnd)}</p>
            </div>
          </section>
          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3.5 font-semibold">Users ({c.users.length})</h2>
            <ul className="divide-y text-sm">
              {c.users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex-1 truncate">
                    {u.name} <span className="text-muted-foreground">· {u.email}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{u.role.name}</span>
                  <StatusBadge tone={u.status === "active" ? "success" : "neutral"}>{u.status}</StatusBadge>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3.5 font-semibold">Branches ({c.branches.length})</h2>
            <ul className="divide-y text-sm">
              {c.branches.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-12 font-mono text-xs text-muted-foreground">{b.code}</span>
                  <span className="flex-1">{b.name}</span>
                  <StatusBadge tone={b.status === "active" ? "success" : "neutral"}>{b.status}</StatusBadge>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3.5 font-semibold">Recent activity</h2>
            {logs.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No activity recorded.</p>
            ) : (
              <ul className="divide-y text-sm">
                {logs.map((l) => (
                  <li key={l.id} className="flex gap-3 px-5 py-2.5">
                    <span className="w-36 shrink-0 text-xs text-muted-foreground">{dateTime(l.createdAt)}</span>
                    <span className="flex-1">{l.summary}</span>
                    <span className="text-xs text-muted-foreground">{l.actorName}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <TenantActions
          companyId={c.id}
          status={c.status}
          currentPlanId={sub?.planId ?? null}
          plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </PageBody>
  )
}
