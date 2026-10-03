import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { recordPrint } from "@/server/modules/sales/service"

/** POST /api/v1/challans/[id]/print — records a (re)print with user (SLS-08, DLV-02). */
export const POST = tenantRoute({ perm: ["delivery.view", "sales.view"], allowReadOnly: true }, async ({ ctx, params }) =>
  ok(await recordPrint(ctx, "challan", params.id)),
)
