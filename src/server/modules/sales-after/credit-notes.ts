import "server-only"
import { audit } from "@/server/audit"
import { assertBranch, type TenantContext } from "@/server/auth/context"
import { dec, num, round2 } from "@/server/decimal"
import { AppError, businessRule } from "@/server/errors"
import { postCustomerLedger } from "@/server/modules/ledger/service"
import { nextNumber } from "@/server/modules/common/sequence"
import type { CreditNoteOutput } from "@/lib/validation/sales-after"
import { splitCreditNote } from "./calc"
import { branchFor, docDateTime, lockCustomer, lockInvoices, pd, run } from "./shared"

/**
 * Manual credit note (goodwill, price correction): customer ledger credit; when linked to an invoice
 * it reduces that invoice's due first (never below 0), the rest stays as customer credit.
 */
export async function createCreditNote(ctx: TenantContext, input: CreditNoteOutput) {
  return run(async (tx) => {
    const branch = await branchFor(tx, ctx, input.branchId)
    const customer = await lockCustomer(tx, ctx.companyId, input.customerId)
    const amount = round2(input.amount)
    let dueReduction = dec(0)
    let invoiceNumber: string | null = null
    if (input.invoiceId) {
      const [inv] = await lockInvoices(tx, ctx.companyId, [input.invoiceId])
      if (!inv || inv.customerId !== customer.id)
        throw new AppError("VALIDATION_ERROR", "Invoice does not belong to this customer", { fields: { invoiceId: "Not this customer's invoice" } })
      assertBranch(ctx, inv.branchId)
      if (inv.status === "cancelled" || inv.status === "draft") throw businessRule(`Invoice ${inv.number} is ${inv.status}`)
      dueReduction = pd(splitCreditNote(amount.toString(), inv.dueAmount).dueReduction)
      if (dueReduction.gt(0)) await tx.invoice.update({ where: { id: inv.id }, data: { dueAmount: { decrement: dueReduction } } })
      invoiceNumber = inv.number
    }
    const date = docDateTime(input.date)
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "CN", branchId: branch.id, branchCode: branch.code, date })
    const cn = await tx.creditNote.create({
      data: {
        companyId: ctx.companyId,
        branchId: branch.id,
        customerId: customer.id,
        invoiceId: input.invoiceId,
        number,
        amount,
        reason: input.reason,
        date,
        createdById: ctx.userId,
      },
    })
    await postCustomerLedger(tx, {
      companyId: ctx.companyId,
      customerId: customer.id,
      branchId: branch.id,
      type: "credit_note",
      credit: amount,
      refType: "credit_note",
      refId: cn.id,
      note: `Credit note ${number}${invoiceNumber ? ` on ${invoiceNumber}` : ""}: ${input.reason}`.slice(0, 255),
      date,
      userId: ctx.userId,
    })
    await audit(
      ctx,
      {
        action: "create",
        entityType: "credit_note",
        entityId: cn.id,
        summary: `Credit note ${number}: ${amount.toFixed(2)} to ${customer.name}${invoiceNumber ? ` on ${invoiceNumber}` : ""}`,
        after: { ...cn, dueReduction: dueReduction.toFixed(2) },
      },
      tx,
    )
    return { id: cn.id, number, amount: num(amount), dueReduction: num(dueReduction) }
  })
}
