import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { num } from "@/server/decimal"

/** GET /api/v1/lookup/customers?q= */
export const GET = tenantRoute({}, async ({ req, db }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  const rows = await db.customer.findMany({
    where: { status: "active", ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { code: { contains: q } }] } : {}) },
    orderBy: { name: "asc" },
    take: 20,
  })
  return ok(
    rows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
      address: c.address,
      type: c.type,
      creditLimit: num(c.creditLimit),
      balance: num(c.balance),
    })),
  )
})
