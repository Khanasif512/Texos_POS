import { parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { createPlanInvoice } from "@/server/modules/platform/billing"
import { checkoutSchema } from "@/lib/validation/billing"

/** Choose / upgrade / downgrade a plan: issues an unpaid billing invoice and returns how to pay it. */
export const POST = tenantRoute({ perm: "settings.billing", allowReadOnly: true }, async ({ req, ctx }) => {
  const body = await parseBody(req, checkoutSchema)
  return idempotent(req, ctx.companyId, "billing.checkout", async () => ({
    data: await createPlanInvoice(ctx, body),
    message: "Invoice created",
    status: 201,
  }))
})
