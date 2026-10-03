import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { cancelInvoice } from "@/server/modules/sales/service"
import { cancelInvoiceSchema } from "@/lib/validation/sales"

/** POST /api/v1/invoices/[id]/cancel {reason} — reverses stock, ledger and receipts (SLS-05). */
export const POST = tenantRoute({ perm: "sales.cancel" }, async ({ req, ctx, params }) => {
  const { reason } = await parseBody(req, cancelInvoiceSchema)
  const res = await cancelInvoice(ctx, params.id, reason)
  return ok(res, { message: `Invoice ${res.number} cancelled` })
})
