import { ok, parseBody } from "@/server/api"
import { idempotent } from "@/server/idempotency"
import { tenantRoute } from "@/server/route"
import { createCreditNote } from "@/server/modules/sales-after/credit-notes"
import { listArgsFromRequest, listCreditNotes } from "@/server/modules/sales-after/queries"
import { creditNoteSchema } from "@/lib/validation/sales-after"

/** GET /api/v1/credit-notes?q&source=return|manual&branchId&from&to&page&limit&sort */
export const GET = tenantRoute({ perm: "sales.view" }, async ({ req, ctx, db }) => {
  const { page, limit, args } = listArgsFromRequest(req, ["date", "number", "amount", "createdAt"], "date:desc")
  const r = await listCreditNotes(ctx, db, args)
  return ok(r.rows, { meta: { page, limit, total: r.total, sumAmount: r.sumAmount } })
})

/** POST /api/v1/credit-notes — manual credit note (ledger credit; reduces a linked invoice's due first). */
export const POST = tenantRoute({ perm: "sales.return_approve" }, async ({ req, ctx }) => {
  const input = await parseBody(req, creditNoteSchema)
  return idempotent(req, ctx.companyId, "credit_notes.create", async () => {
    const data = await createCreditNote(ctx, input)
    return { data, status: 201, message: `Credit note ${data.number} issued` }
  })
})
