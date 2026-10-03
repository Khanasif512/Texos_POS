import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { creditNoteDetail } from "@/server/modules/sales-after/queries"

export const GET = tenantRoute({ perm: "sales.view" }, async ({ ctx, db, params }) => ok(await creditNoteDetail(ctx, db, params.id)))
