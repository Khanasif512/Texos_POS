import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"

/** GET /api/v1/lookup/lcs?q=&open=1 — LCs for delivery-charge / expense linking. */
export const GET = tenantRoute({}, async ({ req, db }) => {
  const sp = new URL(req.url).searchParams
  const q = sp.get("q")?.trim() ?? ""
  const rows = await db.lc.findMany({
    where: {
      ...(sp.get("open") ? { status: { not: "closed" } } : {}),
      ...(q ? { lcNumber: { contains: q } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, lcNumber: true, status: true, supplier: { select: { name: true } } },
  })
  return ok(rows.map((l) => ({ id: l.id, lcNumber: l.lcNumber, status: l.status, supplierName: l.supplier.name })))
})
