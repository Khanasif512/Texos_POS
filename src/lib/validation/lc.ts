import { z } from "zod"

// ───────── Constants shared by server and UI ─────────

/** LC-10 status order. */
export const LC_STATUSES = ["draft", "opened", "goods_in_transit", "received", "cost_finalized", "closed"] as const
export type LcStatus = (typeof LC_STATUSES)[number]

export const LC_STATUS_LABEL: Record<LcStatus, string> = {
  draft: "Draft",
  opened: "Opened",
  goods_in_transit: "Goods in transit",
  received: "Received",
  cost_finalized: "Cost finalized",
  closed: "Closed",
}

export const LC_STATUS_TONE: Record<LcStatus, "neutral" | "info" | "warning" | "primary" | "success"> = {
  draft: "neutral",
  opened: "info",
  goods_in_transit: "warning",
  received: "primary",
  cost_finalized: "success",
  closed: "neutral",
}

export const lcStatusIndex = (s: string) => LC_STATUSES.indexOf(s as LcStatus)
/** Product lines (and the commercial terms) can change only before goods are received. */
export const linesEditable = (s: string) => lcStatusIndex(s) < lcStatusIndex("received")
/** Landed cost can be calculated once goods are received (rate is final by then). */
export const canCalculate = (s: string) => s === "received" || s === "cost_finalized"

/** LC-02 cost types, in cost-sheet order. */
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
export type LcCostType = (typeof LC_COST_TYPES)[number]

export const LC_COST_TYPE_LABEL: Record<LcCostType, string> = {
  lc_opening: "LC opening cost",
  freight: "Freight",
  port: "Port cost",
  cnf: "CNF cost",
  transport: "Transport",
  unloading: "Unloading",
  delivery: "Delivery",
  staff_salary: "Staff salary (allocated)",
  entertainment: "Entertainment (allocated)",
  customs_duty: "Customs duty",
  other: "Other charges",
}

export const LC_CURRENCIES = ["RMB", "USD"] as const
export const BASIS_LABEL = { weight: "Weight basis", quantity: "Quantity basis" } as const

// ───────── Schemas ─────────

const optText = (max: number) => z.string().trim().max(max).nullish().or(z.literal("")).transform((v) => v || null)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
const optDate = isoDate.optional().nullable().or(z.literal("")).transform((v) => v || null)
const maxDp = (dp: number) => (v: number) => Number.isFinite(v) && Math.abs(v * 10 ** dp - Math.round(v * 10 ** dp)) < 1e-6

export const lcLineSchema = z.object({
  id: z.string().optional(),
  variationId: z.string().min(1, "Choose a product"),
  quantity: z.coerce.number<number>().positive("Quantity must be more than 0").max(1e9).refine(maxDp(3), "Up to 3 decimals"),
  unitWeight: z.coerce.number<number>().min(0, "Cannot be negative").max(1e6).refine(maxDp(4), "Up to 4 decimals"),
  unitPriceForeign: z.coerce.number<number>().positive("Enter the unit price").max(1e9).refine(maxDp(4), "Up to 4 decimals"),
})
export type LcLineInput = z.input<typeof lcLineSchema>

/** LC-01: header + at least one product line. */
export const lcSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  lcNumber: z.string().trim().min(2, "Enter the LC number").max(60),
  issuingBank: z.string().trim().min(2, "Enter the issuing bank").max(160),
  branchId: z.string().min(1, "Choose the receiving branch"),
  currency: z.enum(LC_CURRENCIES),
  lcValue: z.coerce.number<number>().positive("Enter the LC value").max(1e11).refine(maxDp(4), "Up to 4 decimals"),
  exchangeRate: z.coerce.number<number>().min(0, "Cannot be negative").max(1e5).refine(maxDp(6), "Up to 6 decimals").default(0),
  distributionBasis: z.enum(["weight", "quantity"]).default("weight"),
  openedDate: optDate,
  expectedArrivalDate: optDate,
  actualArrivalDate: optDate,
  notes: optText(5000),
  lines: z.array(lcLineSchema).min(1, "Add at least one product line"),
})
export type LcInput = z.input<typeof lcSchema>
export type LcOutput = z.output<typeof lcSchema>

/** After goods are received only the rate, basis, notes and arrival date can change (LC-07). */
export const lcLockedSchema = lcSchema.pick({ exchangeRate: true, distributionBasis: true, notes: true, actualArrivalDate: true })
export type LcLockedOutput = z.output<typeof lcLockedSchema>

export const lcStatusSchema = z.object({
  status: z.enum(LC_STATUSES),
  /** opened date (→ opened) or actual arrival date (→ received) */
  date: optDate,
})
export type LcStatusInput = z.input<typeof lcStatusSchema>

export const costItemSchema = z.object({
  costType: z.enum(LC_COST_TYPES),
  amount: z.coerce.number<number>().positive("Enter the amount").max(1e12).refine(maxDp(2), "Up to 2 decimals"),
  description: optText(255),
  entryDate: isoDate,
})
export type CostItemInput = z.input<typeof costItemSchema>
export type CostItemOutput = z.output<typeof costItemSchema>

/** Save calculation / finalize (LC-04..07). Reason is required when replacing an existing calculation. */
export const calculationSchema = z.object({
  basis: z.enum(["weight", "quantity"]),
  reason: optText(255),
})
export type CalculationInput = z.input<typeof calculationSchema>
export type CalculationOutput = z.output<typeof calculationSchema>
