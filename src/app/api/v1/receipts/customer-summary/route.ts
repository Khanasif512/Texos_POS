import { ok } from "@/server/api"
import { AppError } from "@/server/errors"
import { tenantRoute } from "@/server/route"
import { customerDueSummary } from "@/server/modules/sales-after/receipts"

/** GET /api/v1/receipts/customer-summary?customerId= — open credit invoices + unapplied advances. */
export const GET = tenantRoute({ perm: ["sales.receipt", "sales.view"] }, async ({ req, ctx, db }) => {
  const customerId = new URL(req.url).searchParams.get("customerId")
  if (!customerId) throw new AppError("VALIDATION_ERROR", "customerId is required")
  return ok(await customerDueSummary(ctx, db, customerId))
})
