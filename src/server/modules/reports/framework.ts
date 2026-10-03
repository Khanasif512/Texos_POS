import "server-only"
import type { LucideIcon } from "lucide-react"
import type { PlanFeatures } from "@/lib/permissions"
import { assertBranch, can, type TenantContext } from "@/server/auth/context"
import { prisma, tenantDb, type TenantDb } from "@/server/db"
import { empty, raw, sql, type Sql } from "./sql"
import type { DateMode, DefaultRange, FilterSpec, ReportResult } from "./types"
import { computeTotals, rangeInstants, resolveRange, visibleColumns, ymd } from "./utils"

export type ReportGroup = "Sales" | "Purchase & LC" | "Inventory" | "Customers & suppliers" | "Finance"
export const REPORT_GROUPS: ReportGroup[] = ["Sales", "Finance", "Inventory", "Purchase & LC", "Customers & suppliers"]

export type ReportDef = {
  slug: string
  title: string
  description: string
  group: ReportGroup
  icon: LucideIcon
  /** user needs at least one of these permissions */
  perm: string[]
  /** plan features that must all be on (TEN-03) */
  features?: (keyof PlanFeatures)[]
  /** at least one of these plan features must be on */
  anyFeature?: (keyof PlanFeatures)[]
  /** financial reports show cost/profit to everyone who can open them */
  financial?: boolean
  /** sales reports: users without sales.view_all see only their own invoices */
  salesScoped?: boolean
  date: DateMode
  defaultRange?: DefaultRange
  /** branch filter offered (default true) */
  branch?: boolean
  filters?: FilterSpec[]
  /** wide reports print landscape */
  landscape?: boolean
  run: (r: RunCtx) => Promise<ReportResult>
}

/** Everything a report's `run` needs, resolved and access-checked. */
export type RunCtx = {
  ctx: TenantContext
  db: TenantDb
  companyId: string
  /** local yyyy-mm-dd (asOf reports: from = to = as-of date) */
  from: string
  to: string
  /** instants for DATETIME columns */
  start: Date
  end: Date
  today: string
  /** effective branch scope (never empty → empty means nothing matches) */
  branchIds: string[]
  /** specific branch requested, if any */
  branchId: string | null
  /** filter values with defaults applied (validated against declared options) */
  value: (key: string) => string | undefined
  showCost: boolean
  /** user lacks sales.view_all: restrict sales data to own invoices */
  ownSales: boolean
  userId: string
  branchName: (id: string | null | undefined) => string
}

export type SearchParams = Record<string, string | string[] | undefined>
const first = (sp: SearchParams, k: string) => {
  const v = sp[k]
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
}

export function reportAccess(ctx: TenantContext, def: ReportDef) {
  const allowed = def.perm.some((p) => can(ctx, p))
  const missing = (def.features ?? []).filter((f) => !ctx.plan.features[f])
  if (def.anyFeature?.length && !def.anyFeature.some((f) => ctx.plan.features[f])) missing.push(def.anyFeature[0])
  return { allowed, locked: missing.length > 0, missing }
}

/** Export (Excel / PDF) needs the reports.export permission and the plan's export feature. */
export function exportAccess(ctx: TenantContext) {
  return { allowed: can(ctx, "reports.export"), locked: !ctx.plan.features.export }
}

/** Filter values from the URL, validated against each declared option list; defaults applied. */
export function readFilterValues(def: ReportDef, sp: SearchParams, dynamicOptions: Record<string, string[]> = {}) {
  const out: Record<string, string | undefined> = {}
  for (const f of def.filters ?? []) {
    const raw = first(sp, f.key)
    if (f.kind === "select") {
      const allowed = Array.isArray(f.options) ? f.options.map((o) => o.value) : dynamicOptions[f.key]
      // absent → report default; explicit "all" → no filter
      if (raw === "all") out[f.key] = undefined
      else out[f.key] = raw && (!allowed || allowed.includes(raw)) ? raw : f.default
    } else if (f.kind === "segment") {
      out[f.key] = raw && f.options.some((o) => o.value === raw) ? raw : f.default
    } else {
      out[f.key] = raw && /^[a-z0-9]{8,40}$/i.test(raw) ? raw : undefined
    }
  }
  return out
}

export async function buildRunCtx(ctx: TenantContext, def: ReportDef, sp: SearchParams): Promise<RunCtx> {
  const now = new Date()
  const today = ymd(now)
  let from = today
  let to = today
  if (def.date === "range") {
    const r = resolveRange(first(sp, "from"), first(sp, "to"), def.defaultRange ?? "this_month", now)
    from = r.from
    to = r.to
  } else if (def.date === "asOf") {
    const r = resolveRange(first(sp, "to"), first(sp, "to"), "today", now)
    from = to = r.to
  }
  const { start, end } = rangeInstants(from, to)

  const requested = def.branch === false ? undefined : first(sp, "branchId")
  let branchIds = ctx.branchIds
  let branchId: string | null = null
  if (requested && requested !== "all") {
    assertBranch(ctx, requested)
    branchIds = [requested]
    branchId = requested
  }

  const allBranches = await prisma.branch.findMany({ where: { companyId: ctx.companyId }, select: { id: true, name: true } })
  const names = new Map(allBranches.map((b) => [b.id, b.name]))
  const values = readFilterValues(def, sp)

  return {
    ctx,
    db: tenantDb(ctx.companyId),
    companyId: ctx.companyId,
    from,
    to,
    start,
    end,
    today,
    branchIds,
    branchId,
    value: (k) => values[k],
    showCost: def.financial === true || can(ctx, "inventory.view_cost"),
    ownSales: def.salesScoped === true && !can(ctx, "sales.view_all"),
    userId: ctx.userId,
    branchName: (id) => (id ? (names.get(id) ?? "—") : "—"),
  }
}

/** SQL fragment restricting an invoice alias to the user's own sales when they lack sales.view_all. */
export function ownSalesSql(r: RunCtx, alias = "i"): Sql {
  if (!r.ownSales) return empty
  const a = alias.replace(/[^a-z_]/gi, "")
  const salesman = raw(`${a}.salesmanId`)
  return sql`AND (${salesman} = ${r.userId} OR (${salesman} IS NULL AND ${raw(`${a}.createdById`)} = ${r.userId}))`
}

/** Apply visibility rules (cost columns) and fill in totals. */
export function finalizeResult(result: ReportResult, showCost: boolean): ReportResult {
  return {
    ...result,
    summary: result.summary?.filter((s) => showCost || !s.cost),
    chart: result.chart
      ? (() => {
          const series = result.chart.series.filter((s) => showCost || !s.cost)
          return series.length ? { ...result.chart, series } : null
        })()
      : null,
    tables: result.tables.map((t) => {
      const columns = visibleColumns(t.columns, showCost)
      const totals = t.totals === undefined ? computeTotals(columns, t.rows) : t.totals
      return { ...t, columns, totals }
    }),
  }
}

export async function runReport(ctx: TenantContext, def: ReportDef, sp: SearchParams) {
  const r = await buildRunCtx(ctx, def, sp)
  const result = finalizeResult(await def.run(r), r.showCost)
  return { r, result }
}
