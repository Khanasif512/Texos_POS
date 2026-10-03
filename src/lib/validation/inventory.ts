import { z } from "zod"

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const qty = z.coerce.number({ error: "Enter a quantity" }).positive("Must be more than 0").max(1e9, "Too large")
const cost = z.coerce.number({ error: "Enter a cost" }).min(0, "Cannot be negative").max(1e11, "Too large")
/** "" / null → undefined (blank optional number input) */
const blankToUndefined = (v: unknown) => (v === "" || v == null ? undefined : v)

export const ADJUSTMENT_REASONS = [
  { value: "damage", label: "Damage" },
  { value: "count_correction", label: "Count correction" },
  { value: "expired", label: "Expired" },
  { value: "lost", label: "Lost / missing" },
  { value: "found", label: "Found" },
  { value: "other", label: "Other" },
] as const
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]["value"]
const REASON_VALUES = ADJUSTMENT_REASONS.map((r) => r.value) as [AdjustmentReason, ...AdjustmentReason[]]

/** INV-05: signed quantity per line; + lines may carry a unit cost (defaults to the last known cost). */
export const adjustmentSchema = z
  .object({
    branchId: z.string().min(1, "Choose a branch"),
    reason: z.enum(REASON_VALUES, { error: "Choose a reason" }),
    date: dateStr,
    note: optText(255),
    lines: z
      .array(
        z.object({
          variationId: z.string().min(1, "Choose a product"),
          quantity: z.coerce
            .number({ error: "Enter a quantity" })
            .min(-1e9, "Too large")
            .max(1e9, "Too large")
            .refine((n) => n !== 0, "Use + to add or − to remove"),
          unitCost: z.preprocess(blankToUndefined, cost.optional()),
        }),
      )
      .min(1, "Add at least one product")
      .max(300, "Too many lines"),
  })
  .superRefine((v, c) => {
    if (v.reason === "other" && !v.note) c.addIssue({ code: "custom", path: ["note"], message: "Explain the adjustment" })
  })
export type AdjustmentInput = z.input<typeof adjustmentSchema>
export type AdjustmentOutput = z.output<typeof adjustmentSchema>

/** Opening stock for migrating existing inventory. */
export const openingStockSchema = z.object({
  branchId: z.string().min(1, "Choose a branch"),
  date: dateStr,
  note: optText(255),
  lines: z
    .array(z.object({ variationId: z.string().min(1, "Choose a product"), quantity: qty, unitCost: cost }))
    .min(1, "Add at least one product")
    .max(1000, "Up to 1000 lines per entry"),
})
export type OpeningStockInput = z.input<typeof openingStockSchema>
export type OpeningStockOutput = z.output<typeof openingStockSchema>

/** Inter-branch transfer: dispatch from the source branch, received later at the destination. */
export const transferSchema = z
  .object({
    fromBranchId: z.string().min(1, "Choose the source branch"),
    toBranchId: z.string().min(1, "Choose the destination branch"),
    date: dateStr,
    note: optText(255),
    lines: z
      .array(z.object({ variationId: z.string().min(1, "Choose a product"), quantity: qty }))
      .min(1, "Add at least one product")
      .max(300, "Too many lines"),
  })
  .refine((v) => v.fromBranchId !== v.toBranchId, { path: ["toBranchId"], message: "Choose a different branch" })
export type TransferInput = z.input<typeof transferSchema>
export type TransferOutput = z.output<typeof transferSchema>
