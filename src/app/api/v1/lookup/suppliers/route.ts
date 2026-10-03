import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"

/** GET /api/v1/lookup/suppliers?q= */
export const GET = tenantRoute({}, async ({ req, db }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  const rows = await db.supplier.findMany({
    where: { status: "active", ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {}) },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, code: true, name: true, country: true, currency: true },
  })
  return ok(rows)
})
