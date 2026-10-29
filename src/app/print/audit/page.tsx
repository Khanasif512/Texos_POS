import type { Metadata } from "next"
import Image from "next/image"
import { LogoMark } from "@/components/brand/logo"
import { PrintSheet, PrintToolbar } from "@/components/shared/print-toolbar"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { auditLogWhere } from "@/server/modules/org/audit"
import { readListParams, type ListSearchParams } from "@/server/list"
import { dateTime } from "@/lib/format"
import { humanize } from "@/app/app/org/audit/diff"

export const metadata: Metadata = { title: "Print audit log" }

export default async function AuditPrintPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/print/audit")
  ensurePermission(ctx, "org.audit")
  const p = readListParams(await searchParams, {
    sortable: ["createdAt", "entityType", "action", "actorName"],
    defaultSort: "createdAt:desc",
    pageSize: 25,
  })
  const where = auditLogWhere(ctx.companyId, {
    entity: p.get("entity"),
    action: p.get("action"),
    actor: p.get("actor"),
    from: p.from,
    to: p.to,
    q: p.q,
  })
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [p.orderBy, { id: "desc" }],
      skip: p.skip,
      take: p.take,
      select: {
        id: true,
        createdAt: true,
        actorType: true,
        actorName: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        ip: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ])
  const first = total === 0 ? 0 : (p.page - 1) * p.limit + 1
  const last = Math.min(total, p.page * p.limit)
  const generatedAt = new Date()
  const activeFilters = [
    p.get("entity") ? `Record: ${humanize(p.get("entity")!)}` : null,
    p.get("action") ? `Action: ${humanize(p.get("action")!)}` : null,
    p.get("actor") ? `Performed by: ${p.get("actor")}` : null,
    p.from || p.to ? `Date: ${p.from ?? "Earliest"} – ${p.to ?? "Latest"}` : null,
    p.q ? `Search: ${p.q}` : null,
  ].filter((filter): filter is string => filter !== null)

  return (
    <>
      <style>{`@page { size: A4 landscape; margin: 10mm; } @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <PrintToolbar title="Audit log" />
      <PrintSheet landscape>
        <main className="font-sans text-slate-900">
          <header className="mb-6 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-8 border-b-4 border-cyan-400 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-7 py-6 text-white">
              <div className="flex min-w-0 items-center gap-3">
                {ctx.company.logoUrl && (
                  <Image
                    src={ctx.company.logoUrl}
                    alt={`${ctx.company.name} logo`}
                    width={52}
                    height={52}
                    className="size-[52px] shrink-0 rounded-lg border border-white/20 bg-white object-contain p-1.5"
                    unoptimized
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold tracking-tight">{ctx.company.name}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <LogoMark className="size-4 rounded-[4px]" />
                    <p className="text-[9px] font-semibold tracking-[0.16em] uppercase">
                      <span className="text-white">Texon</span><span className="text-cyan-300">POS</span>
                      <span className="ml-2 font-medium tracking-[0.12em] text-slate-300">WORKSPACE INTELLIGENCE</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="shrink-0 border-l border-white/20 pl-7 text-right">
                <p className="text-[9px] font-bold tracking-[0.2em] text-cyan-300 uppercase">Governance · {generatedAt.getFullYear()}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">Audit activity</h1>
                <p className="mt-1 text-[10px] text-slate-300">Generated {dateTime(generatedAt)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 bg-slate-50 px-5 py-4">
              <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-indigo-600 bg-white px-4 py-2.5">
                <p className="text-[9px] font-bold tracking-[0.13em] text-slate-500 uppercase">Matching records</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{total}</p>
              </div>
              <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-slate-400 bg-white px-4 py-2.5">
                <p className="text-[9px] font-bold tracking-[0.13em] text-slate-500 uppercase">Displayed range</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{first}–{last}</p>
              </div>
              <div className="rounded-lg border border-slate-200 border-l-[3px] border-l-slate-400 bg-white px-4 py-2.5">
                <p className="text-[9px] font-bold tracking-[0.13em] text-slate-500 uppercase">Page & ordering</p>
                <p className="mt-1.5 text-[11px] font-semibold text-slate-800">
                  {p.page} / {humanize(p.sort.split(":")[0])} · {p.sort.endsWith(":asc") ? "Oldest first" : "Newest first"}
                </p>
              </div>
            </div>
          </header>

          {activeFilters.length > 0 && (
            <section className="mb-5 flex items-start gap-4 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3" aria-label="Applied filters">
              <p className="shrink-0 pt-0.5 text-[9px] font-bold tracking-[0.13em] text-indigo-900 uppercase">Report scope</p>
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <span key={filter} className="rounded-md border border-indigo-100 bg-white px-2.5 py-1 text-[9px] font-medium text-slate-700">
                    {filter}
                  </span>
                ))}
              </div>
            </section>
          )}

          <table className="w-full border-collapse text-left text-[10px]">
            <thead className="table-header-group">
              <tr className="border-y border-slate-800 bg-slate-900 text-white">
                <th className="w-[14%] px-3 py-3 font-semibold tracking-wide">Date & time</th>
                <th className="w-[11%] px-3 py-3 font-semibold tracking-wide">Action</th>
                <th className="w-[17%] px-3 py-3 font-semibold tracking-wide">Record</th>
                <th className="px-3 py-3 font-semibold tracking-wide">Activity summary</th>
                <th className="w-[15%] px-3 py-3 font-semibold tracking-wide">Performed by</th>
                <th className="w-[12%] px-3 py-3 font-semibold tracking-wide">IP address</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200 break-inside-avoid odd:bg-white even:bg-slate-50">
                  <td className="px-3 py-3 align-top font-medium whitespace-nowrap text-slate-700">{dateTime(row.createdAt)}</td>
                  <td className="px-3 py-3 align-top whitespace-nowrap">
                    <span className="inline-block rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-900">
                      {humanize(row.action)}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className="font-semibold text-slate-800">{humanize(row.entityType)}</span>
                    {row.entityId && <span className="mt-1 block break-all font-mono text-[9px] text-slate-500">ID {row.entityId}</span>}
                  </td>
                  <td className="px-3 py-3 align-top leading-relaxed text-slate-700">
                    {row.summary ?? `${humanize(row.action)} ${humanize(row.entityType).toLowerCase()}`}
                  </td>
                  <td className="px-3 py-3 align-top whitespace-nowrap text-slate-700">
                    {row.actorName ?? "System"}
                    {row.actorType === "admin" && <span className="text-slate-500"> · Platform</span>}
                  </td>
                  <td className="px-3 py-3 align-top font-mono whitespace-nowrap text-slate-600">
                    {row.ip ?? "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="border-b border-slate-200 bg-slate-50 p-12 text-center">
                    <p className="text-sm font-semibold text-slate-700">No activity to report</p>
                    <p className="mt-1 text-[10px] text-slate-500">No audit entries match the selected report scope.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <footer className="mt-5 flex items-center justify-between border-t-2 border-indigo-900 pt-3 text-[9px] text-slate-500">
            <span className="font-semibold tracking-[0.12em] uppercase">Confidential · Workspace audit report</span>
            <span>{ctx.company.name} · TexonPOS · {dateTime(generatedAt)}</span>
          </footer>
        </main>
      </PrintSheet>
    </>
  )
}
