import "server-only"
import type { TenantContext } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { REPORT_GROUPS, reportAccess, type ReportDef, type RunCtx } from "./framework"
import { FINANCE_REPORTS } from "./defs/finance"
import { INVENTORY_REPORTS } from "./defs/inventory"
import { ITEM_REPORTS } from "./defs/items"
import { PARTY_REPORTS } from "./defs/parties"
import { PURCHASE_REPORTS } from "./defs/purchase"
import { SALES_REPORTS } from "./defs/sales"
import type { FilterOption, ResolvedFilter } from "./types"
import { rangeLabel } from "./utils"

export const REPORTS: ReportDef[] = [...SALES_REPORTS, ...ITEM_REPORTS, ...FINANCE_REPORTS, ...INVENTORY_REPORTS, ...PURCHASE_REPORTS, ...PARTY_REPORTS]

const BY_SLUG = new Map(REPORTS.map((r) => [r.slug, r]))
export const getReport = (slug: string) => BY_SLUG.get(slug)

/** Catalogue for a user: reports they have permission for, grouped; plan-locked ones flagged. */
export function reportCatalogue(ctx: TenantContext) {
  return REPORT_GROUPS.map((group) => ({
    group,
    reports: REPORTS.filter((r) => r.group === group)
      .map((def) => ({ def, access: reportAccess(ctx, def) }))
      .filter((x) => x.access.allowed),
  })).filter((g) => g.reports.length > 0)
}

/** Filter bar state: option lists for selects and labels for picked entities. */
export async function resolveFilters(ctx: TenantContext, def: ReportDef, r: RunCtx): Promise<ResolvedFilter[]> {
  const db = tenantDb(ctx.companyId)
  const out: ResolvedFilter[] = []
  for (const f of def.filters ?? []) {
    const value = r.value(f.key)
    if (f.kind === "segment") {
      out.push({ key: f.key, label: f.label, kind: "segment", options: f.options, value: value ?? f.default })
    } else if (f.kind === "select") {
      let options: FilterOption[]
      if (f.options === "salesmen") {
        if (r.ownSales) continue
        const users = await db.user.findMany({ where: { status: "active" }, orderBy: { name: "asc" }, select: { id: true, name: true } })
        options = users.map((u) => ({ value: u.id, label: u.name }))
      } else if (f.options === "categories") {
        const cats = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
        options = cats.map((c) => ({ value: c.id, label: c.name }))
      } else options = f.options
      out.push({ key: f.key, label: f.label, kind: "select", options, value: value ?? null, allLabel: f.allLabel ?? `All`, hasDefault: f.default !== undefined })
    } else {
      let picked: { id: string; label: string } | null = null
      if (value) {
        if (f.kind === "customer") {
          const c = await db.customer.findFirst({ where: { id: value }, select: { id: true, name: true, phone: true } })
          if (c) picked = { id: c.id, label: c.phone ? `${c.name} · ${c.phone}` : c.name }
        } else if (f.kind === "supplier") {
          const s = await db.supplier.findFirst({ where: { id: value }, select: { id: true, name: true } })
          if (s) picked = { id: s.id, label: s.name }
        } else {
          const l = await db.lc.findFirst({ where: { id: value }, select: { id: true, lcNumber: true } })
          if (l) picked = { id: l.id, label: l.lcNumber }
        }
      }
      out.push({ key: f.key, label: f.label, kind: f.kind, value: picked, required: f.required === true })
    }
  }
  return out
}

/** Human description of the applied filters (Excel header rows, print header). */
export function describeFilters(def: ReportDef, r: RunCtx, filters: ResolvedFilter[]) {
  const parts: string[] = []
  if (def.date === "range") parts.push(`Period: ${rangeLabel(r.from, r.to)}`)
  else if (def.date === "asOf") parts.push(`As of: ${rangeLabel(r.to, r.to)}`)
  else parts.push("As of: now")
  if (def.branch !== false) parts.push(`Branch: ${r.branchId ? r.branchName(r.branchId) : r.ctx.allBranches ? "All branches" : "All my branches"}`)
  for (const f of filters) {
    if (f.kind === "segment") parts.push(`${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`)
    else if (f.kind === "select") {
      if (f.value) parts.push(`${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`)
    } else if (f.value) parts.push(`${f.label}: ${f.value.label}`)
  }
  if (r.ownSales) parts.push("Own sales only")
  return parts
}
