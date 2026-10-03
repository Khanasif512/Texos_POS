import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { customerDto, deleteCustomer, getCustomer, updateCustomer } from "@/server/modules/customers/service"
import { customerUpdateSchema } from "@/lib/validation/customers"

/** → {id, code, name, phone, address, type, creditLimit, balance} (same shape as POST /api/v1/customers) */
export const GET = tenantRoute({ perm: "customers.view" }, async ({ db, params }) => ok(customerDto(await getCustomer(db, params.id))))

export const PATCH = tenantRoute({ perm: "customers.update" }, async ({ req, ctx, db, params }) => {
  const customer = await updateCustomer(ctx, db, params.id, await parseBody(req, customerUpdateSchema))
  return ok(customer, { message: "Customer updated" })
})

export const DELETE = tenantRoute({ perm: "customers.delete" }, async ({ ctx, db, params }) => {
  await deleteCustomer(ctx, db, params.id)
  return ok({ id: params.id }, { message: "Customer deleted" })
})
