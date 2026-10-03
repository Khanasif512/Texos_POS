import { z } from "zod"

/** After-sale flows: money receipts, returns, credit notes, quotations & sales orders (SLS-04/06/07). */

const optText = (max: number) => z.string().trim().max(max).optional().nullable().or(z.literal("")).transform((v) => v || null)
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const optDate = isoDate.optional().nullable().or(z.literal("")).transform((v) => v || null)
const money = (msg = "Enter an amount") => z.coerce.number({ message: msg }).min(0).max(1e12)
const positiveMoney = (msg = "Enter an amount") => z.coerce.number({ message: msg }).gt(0, msg).max(1e12)
const qty = z.coerce.number({ message: "Enter a quantity" }).gt(0, "Must be more than 0").max(1e9)

export const PAYMENT_METHODS = ["cash", "bank", "mobile_banking", "card", "cheque"] as const
export const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Cash",
  bank: "Bank transfer",
  mobile_banking: "Mobile banking",
  card: "Card",
  cheque: "Cheque",
}
export const paymentMethodSchema = z.enum(PAYMENT_METHODS)

// ───────── Money receipts (SLS-04) ─────────

export const receiptSchema = z
  .object({
    customerId: z.string().min(1, "Choose a customer"),
    branchId: z.string().min(1, "Choose a branch"),
    date: isoDate,
    method: paymentMethodSchema.default("cash"),
    reference: optText(120),
    note: optText(255),
    amount: positiveMoney("Enter the amount received"),
    /** omit to let the server allocate oldest-first; [] = keep it all as an advance */
    allocations: z
      .array(z.object({ invoiceId: z.string().min(1), amount: money() }))
      .max(200)
      .optional(),
  })
  .superRefine((v, c) => {
    if (!v.allocations) return
    const allocated = v.allocations.reduce((a, x) => a + x.amount, 0)
    if (allocated - v.amount > 0.004) c.addIssue({ code: "custom", path: ["amount"], message: "Allocated more than the amount received" })
    if (new Set(v.allocations.map((a) => a.invoiceId)).size !== v.allocations.length)
      c.addIssue({ code: "custom", path: ["allocations"], message: "An invoice is listed twice" })
  })
export type ReceiptInput = z.input<typeof receiptSchema>
export type ReceiptOutput = z.output<typeof receiptSchema>

export const applyAdvanceSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  /** limit to one invoice (otherwise all open invoices, oldest first) */
  invoiceId: z.string().optional().nullable(),
})
export type ApplyAdvanceOutput = z.output<typeof applyAdvanceSchema>

export const cancelSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(255) })
export type CancelOutput = z.output<typeof cancelSchema>

// ───────── Returns (SLS-06 + approval) ─────────

export const REFUND_MODES = ["credit_note", "cash"] as const
export const refundModeSchema = z.enum(REFUND_MODES)

export const returnSchema = z.object({
  invoiceId: z.string().min(1, "Choose an invoice"),
  date: isoDate,
  reason: z.string().trim().min(3, "Give a reason for the return").max(255),
  restock: z.boolean().default(true),
  refundMode: refundModeSchema,
  lines: z
    .array(z.object({ invoiceLineId: z.string().min(1), quantity: qty }))
    .min(1, "Choose at least one item to return")
    .max(200),
})
export type ReturnInput = z.input<typeof returnSchema>
export type ReturnOutput = z.output<typeof returnSchema>

export const rejectSchema = z.object({ note: z.string().trim().min(3, "Tell the requester why").max(255) })
export type RejectOutput = z.output<typeof rejectSchema>

// ───────── Credit notes ─────────

export const creditNoteSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  branchId: z.string().min(1, "Choose a branch"),
  invoiceId: z.string().optional().nullable().or(z.literal("")).transform((v) => v || null),
  amount: positiveMoney(),
  reason: z.string().trim().min(3, "Give a reason").max(255),
  date: isoDate,
})
export type CreditNoteInput = z.input<typeof creditNoteSchema>
export type CreditNoteOutput = z.output<typeof creditNoteSchema>

// ───────── Quotations & sales orders (SLS-07) ─────────

export const advanceSchema = z.object({
  amount: positiveMoney("Enter the advance amount"),
  method: paymentMethodSchema.default("cash"),
  reference: optText(120),
  date: isoDate.optional(),
})
export type AdvanceOutput = z.output<typeof advanceSchema>

export const salesOrderSchema = z
  .object({
    type: z.enum(["quotation", "order"]),
    branchId: z.string().min(1, "Choose a branch"),
    customerId: z.string().optional().nullable().or(z.literal("")).transform((v) => v || null),
    date: isoDate,
    validUntil: optDate,
    discount: money().default(0),
    note: optText(2000),
    lines: z
      .array(
        z.object({
          variationId: z.string().min(1, "Choose a product"),
          quantity: qty,
          unitPrice: money("Enter a price"),
          discount: money().default(0),
        }),
      )
      .min(1, "Add at least one item")
      .max(300),
    /** optional advance taken with a new order (orders only) */
    advance: advanceSchema.optional().nullable(),
  })
  .superRefine((v, c) => {
    if (v.type === "order" && !v.customerId) c.addIssue({ code: "custom", path: ["customerId"], message: "A sales order needs a customer" })
    if (v.validUntil && v.validUntil < v.date) c.addIssue({ code: "custom", path: ["validUntil"], message: "Must be on or after the date" })
    v.lines.forEach((l, i) => {
      if (l.discount > l.quantity * l.unitPrice + 0.004)
        c.addIssue({ code: "custom", path: ["lines", i, "discount"], message: "Discount exceeds the line amount" })
    })
    const sub = v.lines.reduce((a, l) => a + l.quantity * l.unitPrice - l.discount, 0)
    if (v.discount > sub + 0.004) c.addIssue({ code: "custom", path: ["discount"], message: "Discount exceeds the subtotal" })
    if (v.advance && v.type !== "order") c.addIssue({ code: "custom", path: ["advance"], message: "Advances are taken on orders, not quotations" })
  })
export type SalesOrderInput = z.input<typeof salesOrderSchema>
export type SalesOrderOutput = z.output<typeof salesOrderSchema>
