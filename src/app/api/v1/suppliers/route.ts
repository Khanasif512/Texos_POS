import { listParams, ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createSupplier, listSuppliers, SUPPLIER_SORTABLE } from "@/server/modules/suppliers/service"
import { supplierSchema } from "@/lib/validation/suppliers"

/** GET /api/v1/suppliers?q&status&currency&page&limit&sort=name:asc */
export const GET = tenantRoute({ perm: "suppliers.view" }, async ({ req, db }) => {
  const p = listParams(req, SUPPLIER_SORTABLE, "name:asc")
  const { rows, total } = await listSuppliers(db, {
    q: p.q,
    status: p.sp.get("status") ?? undefined,
    currency: p.sp.get("currency") ?? undefined,
    skip: p.skip,
    take: p.limit,
    orderBy: p.orderBy,
  })
  return ok(rows, { meta: { page: p.page, limit: p.limit, total } })
})

export const POST = tenantRoute({ perm: "suppliers.create" }, async ({ req, ctx }) => {
  const supplier = await createSupplier(ctx, await parseBody(req, supplierSchema))
  return ok(supplier, { status: 201, message: "Supplier created" })
})
