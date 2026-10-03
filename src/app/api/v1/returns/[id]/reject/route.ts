import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { rejectReturn } from "@/server/modules/sales-after/returns"
import { rejectSchema } from "@/lib/validation/sales-after"

/** POST /api/v1/returns/:id/reject { note } */
export const POST = tenantRoute({ perm: "sales.return_approve" }, async ({ req, ctx, params }) => {
  const data = await rejectReturn(ctx, params.id, await parseBody(req, rejectSchema))
  return ok(data, { message: `Return ${data.number} rejected` })
})
