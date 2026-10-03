import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { invoiceForTenant } from "@/server/modules/platform/billing"

export const GET = tenantRoute({ perm: "settings.billing", allowReadOnly: true }, async ({ ctx, params }) => ok(await invoiceForTenant(ctx, params.id)))
