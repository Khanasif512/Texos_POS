import { NextResponse } from "next/server"
import { tenantRoute } from "@/server/route"
import { reportWorkbook } from "@/server/modules/reports/excel"
import { filterQuery, loadReport } from "@/server/modules/reports/service"
import { exportFileName } from "@/server/modules/reports/utils"

/**
 * GET /api/v1/reports/:slug/export?format=xlsx|pdf&<filters>
 * xlsx → Excel download; pdf → redirect to the printable page (saved as PDF from the print dialog).
 * Requires reports.export and the plan's "export" feature, plus access to the report itself.
 */
export const GET = tenantRoute({ perm: "reports.export", feature: "export" }, async ({ req, ctx, params }) => {
  const url = new URL(req.url)
  const sp = Object.fromEntries(url.searchParams)
  const format = sp.format ?? "xlsx"
  const rep = await loadReport(ctx, params.slug, sp, { forExport: true })
  if (format === "pdf") {
    const q = filterQuery(sp)
    return NextResponse.redirect(new URL(`/print/reports/${rep.def.slug}${q ? `?${q}` : ""}`, url.origin))
  }
  const buffer = await reportWorkbook(rep, ctx.company.name, ctx.name)
  const name = exportFileName(rep.def.slug, rep.def.date === "none" ? rep.r.today : rep.r.from, rep.def.date === "none" ? null : rep.r.to)
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  })
})
