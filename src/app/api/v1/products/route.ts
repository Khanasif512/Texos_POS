import { listParams, ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createProduct, listProducts, PRODUCT_SORTABLE } from "@/server/modules/products/service"
import { productSchema } from "@/lib/validation/products"

/** GET /api/v1/products?q&categoryId&status&branchId&page&limit&sort=name:asc — q matches name, brand, SKU, barcode. */
export const GET = tenantRoute({ perm: "inventory.view" }, async ({ req, ctx, db }) => {
  const p = listParams(req, PRODUCT_SORTABLE, "name:asc")
  const { rows, total } = await listProducts(ctx, db, {
    q: p.q,
    categoryId: p.sp.get("categoryId") ?? undefined,
    status: p.sp.get("status") ?? undefined,
    branchId: p.branchId,
    skip: p.skip,
    take: p.limit,
    orderBy: p.orderBy,
  })
  return ok(rows, { meta: { page: p.page, limit: p.limit, total } })
})

/** Product with its variations in one request (INV-01). Blank SKUs are generated. */
export const POST = tenantRoute({ perm: "inventory.create" }, async ({ req, ctx, db }) => {
  const res = await createProduct(ctx, db, await parseBody(req, productSchema))
  return ok(res, { status: 201, message: "Product created" })
})
