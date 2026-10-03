import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { getInvoiceDetail } from "@/server/modules/sales/queries"

/** GET /api/v1/invoices/[id] — invoice with lines, receipts, challans and print history. Costs only with inventory.view_cost. */
export const GET = tenantRoute({ perm: "sales.view" }, async ({ ctx, params }) => ok(await getInvoiceDetail(ctx, params.id)))
