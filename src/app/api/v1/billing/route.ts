import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { billingSummary } from "@/server/modules/platform/billing"

/** §7: plan, status, usage vs limits, available plans and billing history. Works while read-only. */
export const GET = tenantRoute({ perm: "settings.billing", allowReadOnly: true }, async ({ ctx }) => ok(await billingSummary(ctx)))
