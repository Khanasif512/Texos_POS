import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { approveReturn } from "@/server/modules/sales-after/returns"

/** POST /api/v1/returns/:id/approve — restock, invoice update, credit note or cash refund (one transaction). */
export const POST = tenantRoute({ perm: "sales.return_approve" }, async ({ req, ctx, params }) =>
  idempotent(req, ctx.companyId, "returns.approve", async () => {
    const data = await approveReturn(ctx, params.id)
    return {
      data,
      message: data.creditNote ? `Return approved — credit note ${data.creditNote.number} issued` : `Return approved — refund ${data.totalAmount.toFixed(2)} in cash`,
    }
  }),
)
