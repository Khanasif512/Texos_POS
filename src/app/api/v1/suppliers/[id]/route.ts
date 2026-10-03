import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { deleteSupplier, getSupplier, updateSupplier } from "@/server/modules/suppliers/service"
import { supplierSchema } from "@/lib/validation/suppliers"

export const GET = tenantRoute({ perm: "suppliers.view" }, async ({ db, params }) => ok(await getSupplier(db, params.id)))

export const PATCH = tenantRoute({ perm: "suppliers.update" }, async ({ req, ctx, db, params }) => {
  const supplier = await updateSupplier(ctx, db, params.id, await parseBody(req, supplierSchema))
  return ok(supplier, { message: "Supplier updated" })
})

export const DELETE = tenantRoute({ perm: "suppliers.delete" }, async ({ ctx, db, params }) => {
  await deleteSupplier(ctx, db, params.id)
  return ok({ id: params.id }, { message: "Supplier deleted" })
})
