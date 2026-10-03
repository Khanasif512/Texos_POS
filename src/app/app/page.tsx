import Link from "next/link"
import { ArrowRight, Boxes, Building2, CheckCircle2, Circle, Receipt, Ship, Truck, Users, UserPlus } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const ctx = await requireTenant("/app")
  const db = tenantDb(ctx.companyId)
  const [branches, employees, suppliers, products, customers, lcs, invoices] = await Promise.all([
    db.branch.count({ where: { status: "active" } }),
    db.user.count({ where: { status: "active" } }),
    db.supplier.count(),
    db.product.count(),
    db.customer.count(),
    db.lc.count(),
    db.invoice.count({ where: { status: { not: "cancelled" } } }),
  ])

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

  const kpis = [
    { label: "Today's sales", value: money(0), hint: "Live from Phase 4 POS" },
    { label: "Receivables", value: money(0), hint: `${customers} customers` },
    { label: "Active branches", value: String(branches), hint: `of ${ctx.plan.maxBranches} on ${ctx.plan.name}` },
    { label: "Team members", value: String(employees), hint: `of ${ctx.plan.maxEmployees} seats` },
  ]

  return (
    <PageBody>
      <PageHeader
        title={`${greeting}, ${ctx.name.split(" ")[0]}`}
        description={`Here's what's happening at ${ctx.company.name} today.`}
        actions={
          <Button asChild>
            <Link href="/app/pos">
              <Receipt /> New sale
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="num mt-2 text-2xl font-semibold tracking-tight">{k.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </div>

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

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { icon: Users, label: "Customers", value: customers, href: "/app/customers" },
          { icon: Truck, label: "Suppliers", value: suppliers, href: "/app/suppliers" },
          { icon: Boxes, label: "Products", value: products, href: "/app/products" },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="flex items-center gap-4 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
            <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <c.icon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="num text-xl font-semibold">{c.value}</p>
            </div>
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </PageBody>
  )
}
