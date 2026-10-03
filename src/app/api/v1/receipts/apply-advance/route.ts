import { parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { applyAdvance } from "@/server/modules/sales-after/receipts"
import { applyAdvanceSchema } from "@/lib/validation/sales-after"

/** POST /api/v1/receipts/apply-advance { customerId, invoiceId? } — allocate unapplied advances, oldest first. */
export const POST = tenantRoute({ perm: "sales.receipt" }, async ({ req, ctx }) => {
  const input = await parseBody(req, applyAdvanceSchema)
  return idempotent(req, ctx.companyId, "receipts.apply_advance", async () => {
    const data = await applyAdvance(ctx, input)
    return { data, message: `Applied ${data.applied.toFixed(2)} to ${data.invoices} invoice${data.invoices === 1 ? "" : "s"}` }
  })
})
