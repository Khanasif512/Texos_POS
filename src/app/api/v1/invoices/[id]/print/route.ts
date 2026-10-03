import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { recordPrint } from "@/server/modules/sales/service"

/** POST /api/v1/invoices/[id]/print — records a print (SLS-08). */
export const POST = tenantRoute({ perm: "sales.view", allowReadOnly: true }, async ({ ctx, params }) => ok(await recordPrint(ctx, "invoice", params.id)))
