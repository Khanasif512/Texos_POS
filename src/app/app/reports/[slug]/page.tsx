import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Info, Lock, MousePointerClick } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { ReportActions } from "@/components/reports/report-actions"
import { ReportChartView } from "@/components/reports/report-chart"
import { ReportFilters } from "@/components/reports/report-filters"
import { ReportShell } from "@/components/reports/report-shell"
import { ReportTableView } from "@/components/reports/report-table"
import { formatCell } from "@/components/reports/format-cell"
import { requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { exportAccess, reportAccess, type SearchParams } from "@/server/modules/reports/framework"
import { getReport } from "@/server/modules/reports/registry"
import { filterQuery, loadReport } from "@/server/modules/reports/service"
import { quickRanges } from "@/server/modules/reports/utils"
import { FEATURE_LABELS } from "@/lib/permissions"

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return { title: getReport(slug)?.title ?? "Report" }
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const ctx = await requireTenant(`/app/reports/${slug}`)
  const def = getReport(slug)
  if (!def) notFound()
  const access = reportAccess(ctx, def)
  if (!access.allowed) redirect("/app/forbidden")
  const back = { href: "/app/reports", label: "Reports" }

  if (access.locked)
    return (
      <PageBody>
        <PageHeader title={def.title} description={def.description} back={back} />
        <EmptyState
          icon={Lock}
          title={`Available on a higher plan`}
          text={`${def.title} needs ${FEATURE_LABELS[access.missing[0]]}, which is not included in the ${ctx.plan.name} plan.`}
          action={
            <Button asChild>
              <Link href="/app/settings/billing">See plans</Link>
            </Button>
          }
        />
      </PageBody>
    )

  let loaded
  try {
    loaded = await loadReport(ctx, slug, sp)
  } catch (e) {
    if (e instanceof AppError && e.code === "FORBIDDEN") redirect("/app/forbidden")
    throw e
  }
  const { r, result, filters } = loaded
  const ex = exportAccess(ctx)

  return (
    <PageBody className="space-y-5">
      <PageHeader
        title={def.title}
        description={def.description}
        back={back}
        actions={
          !result.prompt && (
            <ReportActions slug={slug} query={filterQuery(sp)} canExport={ex.allowed} exportLocked={ex.locked} planName={ctx.plan.name} />
          )
        }
      />
      <ReportShell
        filters={
          <ReportFilters
            dateMode={def.date}
            from={r.from}
            to={r.to}
            presets={quickRanges(new Date())}
            showBranch={def.branch !== false}
            filters={filters}
          />
        }
      >
        {result.prompt ? (
          <EmptyState icon={MousePointerClick} title={result.prompt.title} text={result.prompt.text} />
        ) : (
          <>
            {result.summary && result.summary.length > 0 && (
              <div className={`grid grid-cols-2 gap-3 ${result.summary.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
                {result.summary.map((s) => (
                  <StatCard
                    key={s.label}
                    label={s.label}
                    value={typeof s.value === "number" ? (s.type === "money" ? `৳ ${formatCell("money", s.value)}` : formatCell(s.type ?? "int", s.value)) : s.value}
                    hint={s.hint}
                    tone={s.tone}
                    className="min-w-0 p-3 sm:p-4 [&>p:nth-child(2)]:truncate [&>p:nth-child(2)]:text-lg sm:[&>p:nth-child(2)]:text-xl"
                  />
                ))}
              </div>
            )}
            {result.chart && <ReportChartView chart={result.chart} />}
            {result.tables.map((t) => (
              <ReportTableView key={t.key} table={t} />
            ))}
            {result.notes && result.notes.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.notes.map((n) => (
                  <li key={n} className="flex gap-1.5">
                    <Info className="mt-0.5 size-3.5 shrink-0" /> {n}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </ReportShell>
    </PageBody>
  )
}
