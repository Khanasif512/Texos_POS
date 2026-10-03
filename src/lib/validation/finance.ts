import { z } from "zod"

const optText = (max: number) => z.string().trim().max(max).nullish().or(z.literal("")).transform((v) => v || null)
const optId = z.string().trim().max(40).optional().nullable().or(z.literal("")).transform((v) => v || null)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const amount = (msg = "Enter an amount") =>
  z.coerce.number({ error: msg }).refine((v) => Number.isFinite(v), msg).refine((v) => v > 0, msg).refine((v) => v <= 1e12, "Amount is too large")

export const PAYMENT_METHODS = ["cash", "bank", "mobile_banking", "card", "cheque"] as const
export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number]
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  cash: "Cash",
  bank: "Bank",
  mobile_banking: "Mobile banking",
  card: "Card",
  cheque: "Cheque",
}

export const LC_COST_TYPES = [
  "lc_opening",
  "freight",
  "port",
  "cnf",
  "transport",
  "unloading",
  "delivery",
  "staff_salary",
  "entertainment",
  "customs_duty",
  "other",
] as const
export type LcCostTypeKey = (typeof LC_COST_TYPES)[number]
export const LC_COST_TYPE_LABELS: Record<LcCostTypeKey, string> = {
  lc_opening: "LC opening / bank charges",
  freight: "Freight",
  port: "Port charges",
  cnf: "C&F agent",
  transport: "Transport",
  unloading: "Unloading / labour",
  delivery: "Delivery",
  staff_salary: "Staff salary",
  entertainment: "Entertainment",
  customs_duty: "Customs duty",
  other: "Other",
}

/** EXP-01 */
export const expenseCategorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(120),
  lcCostType: z.enum(LC_COST_TYPES).nullable().optional().transform((v) => v ?? null),
  status: z.enum(["active", "inactive"]).default("active"),
})
export type ExpenseCategoryInput = z.input<typeof expenseCategorySchema>
export type ExpenseCategoryOutput = z.output<typeof expenseCategorySchema>

/** Daily expense (EXP-02: optional LC link + allocation to landed cost). */
export const expenseSchema = z
  .object({
    branchId: z.string().min(1, "Choose a branch"),
    categoryId: z.string().min(1, "Choose a category"),
    amount: amount(),
    method: z.enum(PAYMENT_METHODS).default("cash"),
    date: dateStr,
    description: optText(255),
    reference: optText(120),
    lcId: optId,
    allocateToLc: z.boolean().default(false),
  })
  .refine((v) => !v.allocateToLc || !!v.lcId, { path: ["lcId"], message: "Choose the LC to allocate this expense to" })
export type ExpenseInput = z.input<typeof expenseSchema>
export type ExpenseOutput = z.output<typeof expenseSchema>

/** DLV-01: LC-linked delivery charge (stored as a "Delivery Charge" expense allocated to the LC). */
export const deliveryChargeSchema = z.object({
  lcId: z.string().min(1, "Choose the LC"),
  branchId: z.string().min(1, "Choose a branch"),
  amount: amount(),
  method: z.enum(PAYMENT_METHODS).default("cash"),
  date: dateStr,
  description: optText(255),
  reference: optText(120),
})
export type DeliveryChargeInput = z.input<typeof deliveryChargeSchema>
export type DeliveryChargeOutput = z.output<typeof deliveryChargeSchema>

/** FIN-03 */
export const supplierPaymentSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  branchId: z.string().min(1, "Choose a branch"),
  amount: amount(),
  method: z.enum(PAYMENT_METHODS).default("bank"),
  reference: optText(120),
  note: optText(255),
  lcId: optId,
  date: dateStr,
})
export type SupplierPaymentInput = z.input<typeof supplierPaymentSchema>
export type SupplierPaymentOutput = z.output<typeof supplierPaymentSchema>

/** FIN-01 */
export const cashClosingSchema = z.object({
  branchId: z.string().min(1, "Choose a branch"),
  date: dateStr,
  /** only used for the very first closing of a branch (no previous counted cash) */
  openingCash: z.coerce.number().min(0, "Cannot be negative").max(1e12).optional().nullable(),
  countedCash: z.coerce.number({ error: "Enter the counted cash" }).min(0, "Cannot be negative").max(1e12),
  note: optText(255),
})
export type CashClosingInput = z.input<typeof cashClosingSchema>
export type CashClosingOutput = z.output<typeof cashClosingSchema>
