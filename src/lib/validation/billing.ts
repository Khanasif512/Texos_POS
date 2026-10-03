import { z } from "zod"
import { FEATURE_LABELS, type PlanFeatures } from "@/lib/permissions"

const cycle = z.enum(["monthly", "yearly"])
const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null)
const money = (label: string) => z.coerce.number({ error: `Enter ${label}` }).min(0, "Cannot be negative").max(1e11)

// ───────────── Tenant ─────────────

export const checkoutSchema = z.object({ planId: z.string().min(1, "Choose a plan"), cycle })
export type CheckoutInput = z.input<typeof checkoutSchema>

export const paymentReferenceSchema = z.object({
  reference: z.string().trim().min(4, "Enter the transaction ID / reference").max(191),
})
export type PaymentReferenceInput = z.input<typeof paymentReferenceSchema>
export type PaymentReferenceOutput = z.output<typeof paymentReferenceSchema>

export const subscriptionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("auto_renew"), autoRenew: z.boolean() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("resume") }),
])

// ───────────── Super admin ─────────────

const featureKeys = Object.keys(FEATURE_LABELS) as [keyof PlanFeatures, ...(keyof PlanFeatures)[]]

export const planSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "2–40 characters")
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes"),
  name: z.string().trim().min(2, "Enter a plan name").max(80),
  tagline: optText(191),
  priceMonthly: money("the monthly price"),
  priceYearly: money("the yearly price"),
  maxBranches: z.coerce.number().int("Whole number").min(1, "At least 1").max(10_000),
  maxEmployees: z.coerce.number().int("Whole number").min(1, "At least 1").max(100_000),
  /** empty = unlimited */
  maxProducts: z
    .union([z.literal(""), z.null(), z.coerce.number().int("Whole number").min(1, "At least 1").max(10_000_000)])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  features: z.partialRecord(z.enum(featureKeys), z.boolean()).transform((f) => {
    const out = {} as PlanFeatures
    for (const k of featureKeys) out[k] = !!f[k]
    return out
  }),
  isPublic: z.boolean().default(true),
  isDefaultTrial: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
})
export type PlanInput = z.input<typeof planSchema>
export type PlanOutput = z.output<typeof planSchema>

export const manualInvoiceSchema = z.object({
  companyId: z.string().min(1, "Choose a company"),
  /** empty = one-off charge that does not change the subscription */
  planId: z.string().optional().or(z.literal("")).transform((v) => v || null),
  cycle: cycle.default("monthly"),
  amount: money("the amount").refine((v) => v > 0, "Amount must be more than zero"),
  description: z.string().trim().min(3, "Describe the charge").max(191),
  dueDays: z.coerce.number().int().min(0).max(90).default(7),
})
export type ManualInvoiceInput = z.input<typeof manualInvoiceSchema>
export type ManualInvoiceOutput = z.output<typeof manualInvoiceSchema>

export const invoiceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_paid"), reference: optText(191), paidAt: optText(10) }),
  z.object({ action: z.literal("mark_failed") }),
  z.object({ action: z.literal("void") }),
])

export const platformSettingsSchema = z.object({
  trialDays: z.coerce.number().int("Whole days").min(1, "At least 1 day").max(365),
  graceDays: z.coerce.number().int("Whole days").min(0).max(90),
  instructions: z.string().trim().min(10, "Tell tenants how to pay").max(5000),
})
export type PlatformSettingsInput = z.input<typeof platformSettingsSchema>
export type PlatformSettingsOutput = z.output<typeof platformSettingsSchema>

export const messageActionSchema = z.object({ handled: z.boolean() })

export const BILLING_STATUS_LABELS = { unpaid: "Unpaid", paid: "Paid", failed: "Failed", void: "Void" } as const
export const billingStatusTone = (s: string) =>
  s === "paid" ? "success" : s === "unpaid" ? "warning" : s === "failed" ? "danger" : "neutral"
export const SUB_STATUS_TONE = { trialing: "info", active: "success", past_due: "warning", cancelled: "danger", expired: "danger" } as const
