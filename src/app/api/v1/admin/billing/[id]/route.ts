import { ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { AppError } from "@/server/errors"
import { activateInvoice, markInvoiceFailed, voidInvoice } from "@/server/modules/platform/billing"
import { date } from "@/lib/format"
import { invoiceActionSchema } from "@/lib/validation/billing"

export const POST = adminRoute(async ({ req, admin, params }) => {
  const body = await parseBody(req, invoiceActionSchema)
  switch (body.action) {
    case "mark_paid": {
      let paidAt: Date | undefined
      if (body.paidAt) {
        paidAt = new Date(`${body.paidAt}T12:00:00`)
        if (Number.isNaN(paidAt.getTime()) || paidAt > new Date()) throw new AppError("VALIDATION_ERROR", "Payment date cannot be in the future", { fields: { paidAt: "Choose today or an earlier date" } })
      }
      const activated = await activateInvoice(params.id, { reference: body.reference, paidAt, actor: { admin } })
      return ok({ activated }, { message: activated ? `Paid — ${activated.planName} active until ${date(activated.end)}` : "Marked paid" })
    }
    case "mark_failed":
      await markInvoiceFailed(admin, params.id)
      return ok({}, { message: "Marked failed" })
    case "void":
      await voidInvoice(admin, params.id)
      return ok({}, { message: "Invoice voided" })
  }
})
