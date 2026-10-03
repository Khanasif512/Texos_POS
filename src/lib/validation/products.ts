import { z } from "zod"

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null)
const optId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v !== "none" ? v : null))
const amountField = (max = 1e10) => z.coerce.number({ error: "Enter a number" }).min(0, "Cannot be negative").max(max).default(0)
/** blank → null, otherwise a non-negative number */
const optAmount = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number({ error: "Enter a number" }).min(0, "Cannot be negative").max(1e10).nullable())

export const PRODUCT_UNITS = ["pcs", "kg", "set", "sft", "rft", "box", "pair", "sheet", "roll", "meter", "ltr", "bag"] as const
export const UNIT_LABELS: Record<(typeof PRODUCT_UNITS)[number], string> = {
  pcs: "Pieces (pcs)",
  kg: "Kilogram (kg)",
  set: "Set",
  sft: "Square feet (sft)",
  rft: "Running feet (rft)",
  box: "Box",
  pair: "Pair",
  sheet: "Sheet",
  roll: "Roll",
  meter: "Meter",
  ltr: "Litre",
  bag: "Bag",
}

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(120),
  parentId: optId,
})
export type CategoryInput = z.input<typeof categorySchema>
export type CategoryOutput = z.output<typeof categorySchema>

export const variationSchema = z.object({
  /** present for existing variations when editing */
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter a variation name").max(160),
  /** blank → auto-generated from the product + variation name */
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .max(60, "Max 60 characters")
    .regex(/^[A-Z0-9][A-Z0-9._/-]*$/, "Letters, numbers and - . / _ only")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  barcode: optText(80),
  unitWeight: z.coerce.number({ error: "Enter a number" }).min(0, "Cannot be negative").max(1e6).default(0),
  salePrice: amountField(),
  wholesalePrice: optAmount,
  reorderLevel: amountField(1e9),
  status: z.enum(["active", "inactive"]).default("active"),
})
export type VariationInput = z.input<typeof variationSchema>
export type VariationOutput = z.output<typeof variationSchema>

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a product name").max(191),
    categoryId: optId,
    brand: optText(120),
    unit: z.enum(PRODUCT_UNITS).default("pcs"),
    description: optText(5000),
    imageUrl: z.string().trim().url("Enter a valid URL (https://…)").max(500).optional().or(z.literal("")).transform((v) => v || null),
    status: z.enum(["active", "inactive"]).default("active"),
    variations: z.array(variationSchema).min(1, "Add at least one variation").max(100, "Max 100 variations per product"),
  })
  .superRefine((v, ctx) => {
    const seenSku = new Map<string, number>()
    const seenName = new Map<string, number>()
    v.variations.forEach((row, i) => {
      if (row.sku) {
        if (seenSku.has(row.sku)) ctx.addIssue({ code: "custom", path: ["variations", i, "sku"], message: "Duplicate SKU in this product" })
        else seenSku.set(row.sku, i)
      }
      const n = row.name.toLowerCase()
      if (seenName.has(n)) ctx.addIssue({ code: "custom", path: ["variations", i, "name"], message: "Duplicate variation name" })
      else seenName.set(n, i)
    })
  })
export type ProductInput = z.input<typeof productSchema>
export type ProductOutput = z.output<typeof productSchema>

/** Quick per-variation edits from the product detail page. */
export const variationPatchSchema = z.object({
  status: z.enum(["active", "inactive"]).optional(),
  salePrice: z.coerce.number().min(0).max(1e10).optional(),
  wholesalePrice: optAmount.optional(),
  reorderLevel: z.coerce.number().min(0).max(1e9).optional(),
})

// ───────── SKU suggestion (pure, shared by UI preview, server and tests) ─────────

const STOP_WORDS = new Set(["AND", "THE", "OF", "FOR", "WITH", "A", "AN"])

const tokens = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP_WORDS.has(t))

/** Words keep 3 letters, anything with a digit is kept whole ("5MM", "6", "T1"). */
const abbreviate = (t: string) => (/\d/.test(t) ? t.slice(0, 6) : t.slice(0, 3))

/**
 * Suggest a readable SKU from product + variation names.
 *   ("Aluminium Profile Type-1", "6-inch profile") → "ALU-PRO-TYP-1-6INC"
 *   ("Clear Float Glass", "5mm")                   → "CLE-FLO-GLA-5MM"
 */
export function suggestSku(productName: string, variationName = "") {
  const p = tokens(productName)
  const head = p.slice(0, 4).map(abbreviate).join("-") || "SKU"
  const inProduct = new Set(p)
  const tail = tokens(variationName)
    .filter((t) => !inProduct.has(t))
    .map(abbreviate)
    .join("")
    .slice(0, 12)
  return (tail ? `${head}-${tail}` : head).slice(0, 48)
}

/** Make `base` unique against `taken` (case-insensitive) by appending -2, -3, … */
export function uniqueSku(base: string, taken: Iterable<string>) {
  const set = new Set([...taken].map((s) => s.toUpperCase()))
  const b = base.toUpperCase()
  if (!set.has(b)) return b
  for (let i = 2; i < 10_000; i++) {
    const c = `${b}-${i}`
    if (!set.has(c)) return c
  }
  return `${b}-${Date.now().toString(36).toUpperCase()}`
}

/** "৳ 450 – ৳ 1,200" style range helper input: min/max of the given prices (null when empty). */
export function priceRange(prices: number[]): { min: number; max: number } | null {
  if (!prices.length) return null
  return { min: Math.min(...prices), max: Math.max(...prices) }
}
