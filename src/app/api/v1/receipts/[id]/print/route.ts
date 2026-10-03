import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { recordReceiptPrint } from "@/server/modules/sales-after/receipts"

/** POST /api/v1/receipts/:id/print — print status (printCount + PrintLog). */
export const POST = tenantRoute({ perm: ["sales.view", "sales.receipt"], allowReadOnly: true }, async ({ ctx, db, params }) =>
  ok(await recordReceiptPrint(ctx, db, params.id)),
)
