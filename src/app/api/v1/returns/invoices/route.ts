import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { searchReturnableInvoices } from "@/server/modules/sales-after/returns"

/** GET /api/v1/returns/invoices?q= — invoices that can still take a return (picker). */
export const GET = tenantRoute({ perm: "sales.return" }, async ({ req, ctx, db }) =>
  ok(await searchReturnableInvoices(ctx, db, new URL(req.url).searchParams.get("q") ?? "")),
)
