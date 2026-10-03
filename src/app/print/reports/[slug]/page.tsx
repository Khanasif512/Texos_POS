import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { PrintSheet, PrintToolbar } from "@/components/shared/print-toolbar"
import { alignOf, formatCell } from "@/components/reports/format-cell"
import { requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { AppError } from "@/server/errors"
import type { SearchParams } from "@/server/modules/reports/framework"
import { getReport } from "@/server/modules/reports/registry"
import { loadReport } from "@/server/modules/reports/service"
import { dateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return { title: getReport(slug)?.title ?? "Report" }
}

/** Printable report (A4; landscape for wide reports) — the user saves it as PDF from the print dialog. */
export default async function ReportPrintPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const ctx = await requireTenant(`/print/reports/${slug}`)
  if (!getReport(slug)) notFound()
  const rep = await loadReport(ctx, slug, sp, { forExport: true }).catch((e) => {
    if (e instanceof AppError && e.code === "FORBIDDEN") redirect("/app/forbidden")
    if (e instanceof AppError && e.code === "FEATURE_LOCKED") redirect(`/app/reports/${slug}`)
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const company = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { name: true, address: true, phone: true, email: true, binNumber: true },
  })
  const { def, result } = rep
  const landscape = def.landscape === true

  const body = (
    <div className="text-[11px]">
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-3">
        <div>
          <h1 className="text-lg font-bold">{company?.name}</h1>
          {company?.address && <p className="text-[10px] text-neutral-600">{company.address}</p>}
          <p className="text-[10px] text-neutral-600">
            {[company?.phone, company?.email, company?.binNumber && `BIN ${company.binNumber}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold tracking-wide uppercase">{def.title}</p>
          {rep.description.map((d) => (
            <p key={d} className="text-[10px] text-neutral-600">
              {d}
            </p>
          ))}
        </div>
      </header>

      {result.prompt ? (
        <p className="mt-8 text-center text-neutral-500">{result.prompt.text}</p>
      ) : (
        <>
          {result.summary && result.summary.length > 0 && (
            <section className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 border-b border-neutral-300 pb-3">
              {result.summary.map((s) => (
                <div key={s.label}>
                  <p className="text-[9px] tracking-wide text-neutral-500 uppercase">{s.label}</p>
                  <p className="num text-sm font-semibold">{typeof s.value === "number" ? formatCell(s.type ?? "int", s.value) : s.value}</p>
                </div>
              ))}
            </section>
          )}

          {result.tables.map((t) => (
            <section key={t.key} className="mt-4 break-inside-auto">
              {t.title && <h2 className="mb-1.5 text-xs font-semibold">{t.title}</h2>}
              <table className="w-full border-collapse">
                <thead className="table-header-group">
                  <tr className="border-y border-neutral-800">
                    {t.columns.map((c) => (
                      <th key={c.key} className={cn("px-1.5 py-1 text-left font-semibold whitespace-nowrap", alignOf(c) === "right" && "text-right")}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.length === 0 ? (
                    <tr>
                      <td colSpan={t.columns.length} className="py-4 text-center text-neutral-500">
                        {t.empty || "No data."}
                      </td>
                    </tr>
                  ) : (
                    t.rows.map((r, i) => (
                      <tr key={i} className="border-b border-neutral-200 break-inside-avoid">
                        {t.columns.map((c) => (
                          <td key={c.key} className={cn("px-1.5 py-[3px] align-top", alignOf(c) === "right" && "num text-right whitespace-nowrap")}>
                            {formatCell(c.type, r[c.key] ?? null)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {t.totals && t.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-y-2 border-neutral-800 font-semibold">
                      {t.columns.map((c, i) => {
                        const v = t.totals![c.key]
                        return (
                          <td key={c.key} className={cn("px-1.5 py-1", alignOf(c) === "right" && "num text-right whitespace-nowrap")}>
                            {v == null ? (i === 0 && !Object.values(t.totals!).some((x) => typeof x === "string") ? "Total" : "") : formatCell(c.type, v)}
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
              {t.totalRows && (
                <p className="mt-1 text-[10px] text-neutral-500">
                  Showing the first {t.rows.length} of {t.totalRows} rows; totals cover all rows.
                </p>
              )}
            </section>
          ))}

          {result.notes && result.notes.length > 0 && (
            <ul className="mt-4 space-y-0.5 text-[10px] text-neutral-500">
              {result.notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <footer className="mt-6 flex justify-between border-t border-neutral-300 pt-2 text-[9px] text-neutral-500">
        <span>
          Generated {dateTime(new Date())} by {ctx.name}
        </span>
        <span>TexonPOS</span>
      </footer>
    </div>
  )

  return (
    <>
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 10mm; }`}</style>
      <PrintToolbar title={def.title} />
      {landscape ? (
        <div className="mx-auto my-6 w-full max-w-[297mm] overflow-x-auto bg-white p-[10mm] text-neutral-900 shadow-sm print:my-0 print:max-w-none print:overflow-visible print:p-0 print:shadow-none">
          {body}
        </div>
      ) : (
        <PrintSheet>{body}</PrintSheet>
      )}
    </>
  )
}
