import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { returnDetail } from "@/server/modules/sales-after/queries"

export const GET = tenantRoute({ perm: ["sales.view", "sales.return", "sales.return_approve"] }, async ({ ctx, db, params }) =>
  ok(await returnDetail(ctx, db, params.id)),
)
