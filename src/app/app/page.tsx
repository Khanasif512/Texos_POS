import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  Circle,
  PackageX,
  Receipt,
  RotateCcw,
  Ship,
  Truck,
  UserPlus,
  Wallet,
} from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { can, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { dashboardData } from "@/server/modules/finance/dashboard"
import { compactMoney, date, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS_TONE = { confirmed: "success", partially_returned: "warning", returned: "neutral", cancelled: "danger", draft: "neutral" } as const

export default async function DashboardPage() {
  const ctx = await requireTenant("/app")
  const db = tenantDb(ctx.companyId)
  const showDashboard = can(ctx, "dashboard.view")
  const [counts, d] = await Promise.all([
    Promise.all([
      db.branch.count({ where: { status: "active" } }),
      db.user.count({ where: { status: "active" } }),
      db.supplier.count(),
      db.product.count(),
      db.lc.count(),
      db.invoice.count({ where: { status: { not: "cancelled" } } }),
    ]),
    showDashboard ? dashboardData(ctx) : null,
  ])
  const [branches, employees, suppliers, products, lcs, invoices] = counts

  const steps = [
    { done: branches > 1, title: "Add your branches", text: "Showrooms and warehouses each get their own stock and cash.", href: "/app/org/branches", icon: Building2 },
    { done: employees > 1, title: "Invite your team", text: "Give salesmen, store and accounts staff the right roles.", href: "/app/org/employees", icon: UserPlus },
    { done: suppliers > 0, title: "Add suppliers", text: "Overseas and local suppliers with their currency.", href: "/app/suppliers", icon: Truck },
    { done: products > 0, title: "Set up products", text: "Products with variations, SKUs and sale prices.", href: "/app/products", icon: Boxes },
    { done: lcs > 0, title: "Open your first LC", text: "Record charges and get landed cost per unit.", href: "/app/lc", icon: Ship },
    { done: invoices > 0, title: "Make your first sale", text: "Cash or credit invoice from the POS screen.", href: "/app/pos", icon: Receipt },
  ]
  const completed = steps.filter((s) => s.done).length
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const scope = ctx.allBranches ? "all branches" : ctx.branches.length === 1 ? ctx.branches[0].name : `${ctx.branches.length} branches`

  type Kpi = { label: string; value: string; hint: string; href: string | undefined }
  const kpis: Kpi[] = d
    ? ([
        d.sales && {
          label: "Today's sales",
          value: money(d.sales.amount),
          hint: `${d.sales.invoices} invoice${d.sales.invoices === 1 ? "" : "s"}${d.sales.net !== d.sales.amount ? ` · net ${money(d.sales.net)}` : ""}`,
          href: "/app/sales/invoices",
        },
        d.grossProfit && {
          label: "Gross profit today",
          value: money(d.grossProfit.amount),
          hint: d.grossProfit.margin == null ? "No sales yet today" : `${d.grossProfit.margin.toFixed(1)}% margin`,
          href: can(ctx, "finance.view") && ctx.plan.features.advancedReports ? "/app/finance/profit-loss?period=day" : undefined,
        },
        d.receivables && {
          label: "Receivables",
          value: money(d.receivables.amount),
          hint: `${d.receivables.customers} customer${d.receivables.customers === 1 ? "" : "s"} owe you`,
          href: "/app/customers",
        },
        d.cashInHand && {
          label: "Cash in hand",
          value: money(d.cashInHand.amount),
          hint:
            d.cashInHand.closedBranches === d.cashInHand.branches
              ? "Counted at today's closing"
              : `Estimate · ${d.cashInHand.closedBranches}/${d.cashInHand.branches} branches closed`,
          href: can(ctx, "finance.cash_closing") ? "/app/finance/cash-closing" : undefined,
        },
        d.expensesToday &&
          !d.grossProfit && {
            label: "Expenses today",
            value: money(d.expensesToday.amount),
            hint: `${d.expensesToday.count} entr${d.expensesToday.count === 1 ? "y" : "ies"}`,
            href: "/app/expenses",
          },
      ] as (Kpi | null | false)[]).filter((k): k is Kpi => !!k)
    : []

  type Attn = { icon: typeof Ship; label: string; value: number | string; href: string; warn: boolean }
  const attention: Attn[] = []
  if (d?.lowStock != null)
    attention.push({ icon: PackageX, label: "Low-stock items", value: d.lowStock, href: "/app/inventory/low-stock", warn: d.lowStock > 0 })
  if (d?.lcs) {
    attention.push({ icon: Ship, label: "LCs in transit", value: d.lcs.inTransit, href: "/app/lc?status=goods_in_transit", warn: false })
    attention.push({ icon: Ship, label: "LCs arriving in 7 days", value: d.lcs.arriving.length, href: "/app/lc", warn: d.lcs.arriving.length > 0 })
  }
  if (d?.pendingReturns != null)
    attention.push({
      icon: RotateCcw,
      label: "Returns awaiting approval",
      value: d.pendingReturns,
      href: "/app/sales/returns?status=pending",
      warn: d.pendingReturns > 0,
    })
  if (d?.expensesToday && d.grossProfit)
    attention.push({ icon: Wallet, label: "Expenses today", value: money(d.expensesToday.amount), href: "/app/expenses", warn: false })

  return (
    <PageBody>
      <PageHeader
        title={`${greeting}, ${ctx.name.split(" ")[0]}`}
        description={`Here's what's happening at ${ctx.company.name} today · ${scope}.`}
        actions={
          can(ctx, "sales.create") && (
            <Button asChild>
              <Link href="/app/pos">
                <Receipt /> New sale
              </Link>
            </Button>
          )
        }
      />

      {kpis.length > 0 && (
        <div className={cn("grid gap-4 sm:grid-cols-2", kpis.length >= 4 ? "xl:grid-cols-4" : kpis.length === 3 ? "xl:grid-cols-3" : "")}>
          {kpis.map((k) => {
            const body = (
              <>
                <p className="text-sm text-muted-foreground">{k.label}</p>
                <p className="num mt-2 text-2xl font-semibold tracking-tight">{k.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
              </>
            )
            return k.href ? (
              <Link key={k.label} href={k.href} className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
                {body}
              </Link>
            ) : (
              <div key={k.label} className="rounded-xl border bg-card p-5">
                {body}
              </div>
            )
          })}
        </div>
      )}

      {completed < steps.length && (
        <section className="rounded-xl border bg-card">
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Get your workspace ready</h2>
              <p className="text-sm text-muted-foreground">
                {completed} of {steps.length} steps complete
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted sm:w-48">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
            </div>
          </div>
          <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {steps.map((s) => (
              <li key={s.title} className="sm:border-b lg:[&:nth-last-child(-n+3)]:border-b-0">
                <Link href={s.href} className="group flex gap-3 p-5 transition-colors hover:bg-muted/40">
                  {s.done ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through")}>{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.text}</p>
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d && (d.chart || attention.length > 0) && (
        <div className={cn("grid gap-6", d.chart && attention.length > 0 && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
          {d.chart && (
            <section className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="font-semibold">Sales, last 30 days</h2>
                  <p className="text-xs text-muted-foreground">Invoice totals per day (cancelled invoices excluded)</p>
                </div>
                <p className="num text-sm font-medium">{compactMoney(d.chartTotal)}</p>
              </div>
              <div className="px-2 pt-4 pb-2">
                <SalesChart data={d.chart} />
              </div>
            </section>
          )}
          {attention.length > 0 && (
            <section className="rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">Needs attention</h2>
              </div>
              <ul className="divide-y">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link href={a.href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          a.warn ? "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_25%)] dark:text-warning" : "bg-accent text-accent-foreground",
                        )}
                      >
                        <a.icon className="size-4" />
                      </span>
                      <span className="flex-1 text-sm">{a.label}</span>
                      <span className="num font-semibold">{a.value}</span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
              {d.lcs && d.lcs.arriving.length > 0 && (
                <div className="border-t px-5 py-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Arriving soon</p>
                  <ul className="space-y-1.5">
                    {d.lcs.arriving.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
                        <Link href={`/app/lc/${l.id}`} className="num font-medium hover:underline">
                          {l.lcNumber}
                        </Link>
                        <span className="truncate text-muted-foreground">{l.supplier}</span>
                        <span className="shrink-0">{l.expected ? date(`${l.expected}T12:00:00`) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {d && (d.topItems || d.recentInvoices) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {d.topItems && (
            <section className="rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">Top items this month</h2>
                <p className="text-xs text-muted-foreground">By sales value</p>
              </div>
              {d.topItems.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">No sales this month yet.</p>
              ) : (
                <ol className="divide-y">
                  {d.topItems.map((t, i) => {
                    const max = d.topItems![0].amount || 1
                    return (
                      <li key={t.id} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="num w-4 text-xs text-muted-foreground">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{t.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.sku} · {quantity(t.qty)} {t.unit}
                            </p>
                          </div>
                          <span className="num text-sm font-semibold">{money(t.amount)}</span>
                        </div>
                        <div className="mt-2 ml-7 h-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.max(4, (t.amount / max) * 100)}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          )}
          {d.recentInvoices && (
            <section className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="font-semibold">Recent invoices</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/sales/invoices">
                    View all <ArrowRight />
                  </Link>
                </Button>
              </div>
              {d.recentInvoices.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <ul className="divide-y">
                  {d.recentInvoices.map((r) => (
                    <li key={r.id}>
                      <Link href={`/app/sales/invoices/${r.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.customer}</p>
                          <p className="num text-xs text-muted-foreground">
                            {r.number} · {date(r.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="num text-sm font-semibold">{money(r.total)}</p>
                          {r.status !== "confirmed" ? (
                            <StatusBadge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "neutral"} className="capitalize">
                              {r.status.replaceAll("_", " ")}
                            </StatusBadge>
                          ) : r.due > 0 ? (
                            <p className="num text-xs text-destructive">Due {money(r.due)}</p>
                          ) : (
                            <p className="text-xs text-success">Paid</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {!showDashboard && (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0" />
          Your role doesn&apos;t include the business dashboard. Use the menu to open the screens you work with.
        </div>
      )}
    </PageBody>
  )
}
