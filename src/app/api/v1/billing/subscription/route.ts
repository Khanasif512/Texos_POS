import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { updateSubscription } from "@/server/modules/platform/billing"
import { subscriptionActionSchema } from "@/lib/validation/billing"

/** Auto-renew toggle, cancel (NFR-CMP-02) and resume. */
export const POST = tenantRoute({ perm: "settings.billing", allowReadOnly: true }, async ({ req, ctx }) => {
  const r = await updateSubscription(ctx, await parseBody(req, subscriptionActionSchema))
  return ok(r, { message: r.message })
})
