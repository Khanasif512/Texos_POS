import { z } from "zod"

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const optDate = dateStr.optional().or(z.literal("")).transform((v) => v || null)

export const CURRENCIES = ["BDT", "USD", "RMB"] as const

export const PO_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "partially_received", label: "Partially received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
] as const

export const poLineSchema = z.object({
  variationId: z.string().min(1, "Choose a product"),
  quantity: z.coerce.number({ error: "Enter a quantity" }).positive("Must be more than 0").max(1e9, "Too large"),
  /** in the PO currency (BDT for local purchases) */
  unitPrice: z.coerce.number({ error: "Enter a price" }).min(0, "Cannot be negative").max(1e11, "Too large"),
})

export const purchaseOrderSchema = z
  .object({
    supplierId: z.string().min(1, "Choose a supplier"),
    branchId: z.string().min(1, "Choose a branch"),
    invoiceReference: optText(191),
    bankDetails: optText(2000),
    orderDate: dateStr,
    expectedDate: optDate,
    currency: z.enum(CURRENCIES).default("BDT"),
    exchangeRate: z.coerce.number({ error: "Enter the exchange rate" }).positive("Must be more than 0").max(1e6).default(1),
    notes: optText(2000),
    lines: z.array(poLineSchema).min(1, "Add at least one product").max(300, "Too many lines"),
  })
  .superRefine((v, c) => {
    if (v.expectedDate && v.expectedDate < v.orderDate)
      c.addIssue({ code: "custom", path: ["expectedDate"], message: "Cannot be before the order date" })
  })
export type PurchaseOrderInput = z.input<typeof purchaseOrderSchema>
export type PurchaseOrderOutput = z.output<typeof purchaseOrderSchema>

export const cancelPurchaseOrderSchema = z.object({ reason: optText(255) })

/** Goods receipt (PO-02, LC-10). `lineId` is the PO line id (source "po") or LC product line id (source "lc"). */
export const goodsReceiptSchema = z
  .object({
    source: z.enum(["po", "lc"]),
    sourceId: z.string().min(1),
    branchId: z.string().min(1, "Choose the receiving branch"),
    date: dateStr,
    note: optText(255),
    lines: z
      .array(
        z.object({
          lineId: z.string().min(1),
          quantity: z.coerce.number({ error: "Enter a quantity" }).min(0, "Cannot be negative").max(1e9, "Too large"),
        }),
      )
      .min(1, "Nothing to receive"),
  })
  .refine((v) => v.lines.some((l) => l.quantity > 0), { path: ["lines"], message: "Enter a quantity for at least one line" })
export type GoodsReceiptInput = z.input<typeof goodsReceiptSchema>
export type GoodsReceiptOutput = z.output<typeof goodsReceiptSchema>
