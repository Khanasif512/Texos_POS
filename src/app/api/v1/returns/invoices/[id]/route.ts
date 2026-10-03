import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { returnableInvoice } from "@/server/modules/sales-after/returns"

/** GET /api/v1/returns/invoices/:id — lines with returnable quantity and allowed refund modes. */
export const GET = tenantRoute({ perm: "sales.return" }, async ({ ctx, db, params }) => ok(await returnableInvoice(ctx, db, params.id)))
