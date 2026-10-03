import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { receiptDetail } from "@/server/modules/sales-after/queries"

export const GET = tenantRoute({ perm: ["sales.view", "sales.receipt"] }, async ({ ctx, db, params }) => ok(await receiptDetail(ctx, db, params.id)))
