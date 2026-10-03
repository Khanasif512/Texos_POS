import { listParams, ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { createCustomer, CUSTOMER_SORTABLE, listCustomers } from "@/server/modules/customers/service"
import { customerSchema } from "@/lib/validation/customers"

/** GET /api/v1/customers?q&type&status&page&limit&sort=name:asc */
export const GET = tenantRoute({ perm: "customers.view" }, async ({ req, db }) => {
  const p = listParams(req, CUSTOMER_SORTABLE, "name:asc")
  const { rows, total } = await listCustomers(db, {
    q: p.q,
    type: p.sp.get("type") ?? undefined,
    status: p.sp.get("status") ?? undefined,
    skip: p.skip,
    take: p.limit,
    orderBy: p.orderBy,
  })
  return ok(rows, { meta: { page: p.page, limit: p.limit, total } })
})

/**
 * POST /api/v1/customers — also used by the POS quick-add.
 * Body {name, phone?, email?, address?, type?, creditLimit?, openingBalance? (+due / −advance), notes?, branchId?}
 * → {id, code, name, phone, address, type, creditLimit, balance}
 */
export const POST = tenantRoute({ perm: "customers.create" }, async ({ req, ctx, db }) => {
  const customer = await createCustomer(ctx, db, await parseBody(req, customerSchema))
  return ok(customer, { status: 201, message: "Customer created" })
})
