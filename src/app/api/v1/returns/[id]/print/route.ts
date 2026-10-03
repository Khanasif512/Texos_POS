import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { recordReturnPrint } from "@/server/modules/sales-after/returns"

/** POST /api/v1/returns/:id/print — PrintLog (docType return). */
export const POST = tenantRoute({ perm: ["sales.view", "sales.return", "sales.return_approve"], allowReadOnly: true }, async ({ ctx, db, params }) =>
  ok(await recordReturnPrint(ctx, db, params.id)),
)
