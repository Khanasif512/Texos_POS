import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { submitPaymentReference } from "@/server/modules/platform/billing"
import { paymentReferenceSchema } from "@/lib/validation/billing"

/** "I have paid": stores the transaction reference; the platform confirms the payment. */
export const POST = tenantRoute({ perm: "settings.billing", allowReadOnly: true }, async ({ req, ctx, params }) => {
  const { reference } = await parseBody(req, paymentReferenceSchema)
  const r = await submitPaymentReference(ctx, params.id, reference)
  return ok(r, { message: r.status === "paid" ? "Payment confirmed" : "Thanks — we will confirm your payment shortly" })
})
