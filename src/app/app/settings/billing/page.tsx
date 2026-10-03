import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/status-badge"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { date } from "@/lib/format"
import { FEATURE_LABELS, type PlanFeatures } from "@/lib/permissions"

export const metadata: Metadata = { title: "Subscription & billing" }

const STATUS_TONE = { trialing: "info", active: "success", past_due: "warning", cancelled: "danger", expired: "danger" } as const

export default async function BillingPage() {
  const ctx = await requireTenant("/app/settings/billing")
  ensurePermission(ctx, "settings.billing")
  const db = tenantDb(ctx.companyId)
  const [branches, employees, invoices] = await Promise.all([
    db.branch.count({ where: { status: "active" } }),
    db.user.count({ where: { status: "active" } }),
    db.billingInvoice.findMany({ orderBy: { issuedAt: "desc" }, take: 12 }),
  ])
  const sub = ctx.subscription
  const usage = [
    { label: "Branches", used: branches, max: ctx.plan.maxBranches },
    { label: "Team members", used: employees, max: ctx.plan.maxEmployees },
  ]
  return (
    <PageBody className="max-w-5xl">
      <PageHeader title="Subscription & billing" description="Your plan, usage and invoices." />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <h2 className="mt-1 text-2xl font-semibold">{ctx.plan.name}</h2>
            </div>
            {sub && <StatusBadge tone={STATUS_TONE[sub.status as keyof typeof STATUS_TONE] ?? "neutral"}>{sub.status.replace("_", " ")}</StatusBadge>}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {sub?.status === "trialing" && sub.trialEndsAt ? `Free trial ends on ${date(sub.trialEndsAt)}.` : null}
            {sub?.status === "active" && sub.currentPeriodEnd ? `Renews on ${date(sub.currentPeriodEnd)}.` : null}
          </p>
          <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            {(Object.keys(FEATURE_LABELS) as (keyof PlanFeatures)[])
              .filter((k) => ctx.plan.features[k])
              .map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Check className="size-4 text-success" /> {FEATURE_LABELS[k]}
                </li>
              ))}
          </ul>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/pricing" target="_blank">
                Compare plans
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact" target="_blank">
                Talk to sales
              </Link>
            </Button>
          </div>
        </section>
        <section className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Usage</h2>
          {usage.map((u) => (
            <div key={u.label}>
              <div className="flex justify-between text-sm">
                <span>{u.label}</span>
                <span className="num text-muted-foreground">
                  {u.used} / {u.max}
                </span>
              </div>
              <Progress value={Math.min(100, (u.used / u.max) * 100)} className="mt-2 h-2" />
            </div>
          ))}
        </section>
      </div>
      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Billing history</h2>
        </div>
        {invoices.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="divide-y">
            {invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="num font-medium">{i.number}</span>
                <span className="text-muted-foreground">{date(i.issuedAt)}</span>
                <span className="num">৳ {Number(i.amount).toLocaleString("en-IN")}</span>
                <StatusBadge tone={i.status === "paid" ? "success" : i.status === "unpaid" ? "warning" : "danger"}>{i.status}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageBody>
  )
}
