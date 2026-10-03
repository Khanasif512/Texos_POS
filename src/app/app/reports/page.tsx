import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BarChart3, Lock } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { reportCatalogue } from "@/server/modules/reports/registry"
import { FEATURE_LABELS } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage() {
  const ctx = await requireTenant("/app/reports")
  ensurePermission(ctx, "reports.sales", "reports.stock", "reports.financial", "finance.cash_closing")
  const groups = reportCatalogue(ctx)

  return (
    <PageBody>
      <PageHeader
        title="Reports"
        description="Every report filters by date range and branch, and exports to Excel or PDF."
      />
      {groups.length === 0 ? (
        <EmptyState icon={BarChart3} title="No reports available" text="Your role does not include any report permissions. Ask your company owner for access." />
      ) : (
        groups.map((g) => (
          <section key={g.group} className="space-y-3">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{g.group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.reports.map(({ def, access }) => {
                const Icon = def.icon
                return (
                  <Link
                    key={def.slug}
                    href={access.locked ? "/app/settings/billing" : `/app/reports/${def.slug}`}
                    className={cn(
                      "group flex gap-4 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      access.locked && "opacity-75",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{def.title}</p>
                        {access.locked && (
                          <StatusBadge tone="neutral">
                            <Lock className="size-3" /> Upgrade
                          </StatusBadge>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {access.locked ? `Needs ${FEATURE_LABELS[access.missing[0]]}. ${def.description}` : def.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                )
              })}
            </div>
          </section>
        ))
      )}
    </PageBody>
  )
}
