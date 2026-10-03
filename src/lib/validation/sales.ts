import { z } from "zod"

const optText = (max: number) => z.string().trim().max(max).optional().nullable().or(z.literal("")).transform((v) => v || null)
const optId = z.string().trim().max(40).optional().nullable().or(z.literal("")).transform((v) => v || null)
const money = (label = "Amount") =>
  z.coerce.number({ error: `Enter a valid ${label.toLowerCase()}` }).min(0, `${label} cannot be negative`).max(1e12, `${label} is too large`)

export const PAYMENT_METHODS = ["cash", "bank", "mobile_banking", "card"] as const
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  mobile_banking: "Mobile banking",
  card: "Card",
  cheque: "Cheque",
}

export const invoiceLineSchema = z.object({
  variationId: z.string().min(1, "Choose a product"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero").max(1e9),
  unitPrice: money("Price"),
  discount: money("Discount").default(0),
  description: optText(255),
})

/** POST /api/v1/invoices — cash or credit invoice from the POS (SLS-01). */
export const invoiceSchema = z.object({
  branchId: z.string().min(1, "Choose a branch"),
  type: z.enum(["cash", "credit"]),
  customerId: optId,
  /** walk-in name/phone for cash sales without a customer record */
  customerName: optText(160),
  customerPhone: optText(40),
  salesmanId: optId,
  salesOrderId: optId,
  lines: z.array(invoiceLineSchema).min(1, "Add at least one item").max(300, "Too many lines"),
  discount: money("Discount").default(0),
  tax: money("Tax").default(0),
  deliveryCharge: money("Delivery charge").default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  /** credit invoices: amount paid at the counter (recorded as a money receipt). Ignored for cash invoices. */
  paidAmount: money("Paid amount").default(0),
  paymentReference: optText(120),
  /** CRM-01 override — requires sales.override_credit */
  overrideCreditLimit: z.boolean().default(false),
  deliveryAddress: optText(500),
  note: optText(1000),
})
export type InvoiceInput = z.input<typeof invoiceSchema>
export type InvoiceOutput = z.output<typeof invoiceSchema>

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3, "Tell us why the invoice is cancelled").max(255),
})
export type CancelInvoiceInput = z.input<typeof cancelInvoiceSchema>
export type CancelInvoiceOutput = z.output<typeof cancelInvoiceSchema>

/** PATCH /api/v1/challans/[id] — delivery info and delivered/undelivered (DLV-02). */
export const challanUpdateSchema = z.object({
  deliveryAddress: optText(500),
  deliveryPerson: optText(120),
  deliveryPhone: optText(40),
  vehicleNo: optText(40),
  deliveryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => v || null),
  note: optText(255),
  showPrices: z.boolean().default(false),
  status: z.enum(["pending", "delivered"]).default("pending"),
})
export type ChallanUpdateInput = z.input<typeof challanUpdateSchema>
export type ChallanUpdateOutput = z.output<typeof challanUpdateSchema>

/** POS quick-add customer — posted to POST /api/v1/customers (customers module). */
export const quickCustomerSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name").max(160),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a phone number")
    .max(40)
    .regex(/^[0-9+\-\s()]+$/, "Digits only"),
  address: optText(500),
  type: z.enum(["retail", "wholesale", "dealer"]).default("retail"),
})
export type QuickCustomerInput = z.input<typeof quickCustomerSchema>
export type QuickCustomerOutput = z.output<typeof quickCustomerSchema>

/** SLS-08 label: "Not printed" / "Printed" / "Reprinted ×N". */
export function printStatusLabel(printCount: number) {
  if (!printCount) return "Not printed"
  if (printCount === 1) return "Printed"
  return `Reprinted ×${printCount - 1}`
}
