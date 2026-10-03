import { z } from "zod"

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null)

export const CUSTOMER_TYPES = ["retail", "wholesale", "dealer"] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = { retail: "Retail", wholesale: "Wholesale", dealer: "Dealer" }

const base = {
  name: z.string().trim().min(2, "Enter the customer's name").max(160),
  phone: optText(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email")
    .max(191)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  address: optText(1000),
  type: z.enum(CUSTOMER_TYPES).default("retail"),
  creditLimit: z.coerce.number({ error: "Enter an amount" }).min(0, "Cannot be negative").max(1e12).default(0),
  notes: optText(2000),
  /** optional home branch */
  branchId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v !== "none" ? v : null)),
  status: z.enum(["active", "inactive"]).default("active"),
}

/**
 * POST /api/v1/customers (also the POS quick-add contract).
 * openingBalance: positive = customer owes us (due), negative = advance paid by the customer. Create only (CRM-02).
 */
export const customerSchema = z.object({
  ...base,
  openingBalance: z.coerce.number({ error: "Enter an amount" }).min(-1e12).max(1e12).default(0),
})
export type CustomerInput = z.input<typeof customerSchema>
export type CustomerOutput = z.output<typeof customerSchema>

/** PATCH: opening balance is fixed after creation and only changes through ledger transactions (CRM-02). */
export const customerUpdateSchema = z.object(base)
export type CustomerUpdateOutput = z.output<typeof customerUpdateSchema>

/** UI form: amount + Due/Advance toggle, converted to a signed opening balance on submit. */
export const customerFormSchema = z.object({
  ...base,
  openingAmount: z.coerce.number({ error: "Enter an amount" }).min(0, "Enter a positive amount").max(1e12).default(0),
  openingSide: z.enum(["due", "advance"]).default("due"),
})
export type CustomerFormInput = z.input<typeof customerFormSchema>
export type CustomerFormOutput = z.output<typeof customerFormSchema>

// ───────── Pure helpers (shared by UI, server and tests) ─────────

export type OpeningSide = "due" | "advance"

/** Amount + side → signed opening balance (positive = due, negative = advance). */
export function signedOpening(amount: number, side: OpeningSide) {
  const a = Math.abs(Number(amount) || 0)
  if (a === 0) return 0
  return side === "advance" ? -a : a
}

/** Signed opening balance → amount + side (for showing a stored value in the form). */
export function splitOpening(signed: number): { amount: number; side: OpeningSide } {
  return { amount: Math.abs(signed), side: signed < 0 ? "advance" : "due" }
}

/** Which side of the customer ledger the opening entry posts to (debit = owes us, credit = advance). */
export function openingLedgerSides(signed: number): { debit: number; credit: number } | null {
  if (!signed) return null
  return signed > 0 ? { debit: signed, credit: 0 } : { debit: 0, credit: -signed }
}

/** Remaining credit before the limit is hit (an advance increases it). 0 limit = no credit sales. */
export function availableCredit(creditLimit: number, balance: number) {
  return Math.max(0, Math.round((creditLimit - balance) * 100) / 100)
}

/** How to present a customer balance: positive = due (red), negative = advance (green). */
export function balanceState(balance: number): { kind: "due" | "advance" | "settled"; amount: number } {
  if (balance > 0.004) return { kind: "due", amount: balance }
  if (balance < -0.004) return { kind: "advance", amount: -balance }
  return { kind: "settled", amount: 0 }
}
