import { z } from "zod"

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null)

export const SUPPLIER_CURRENCIES = ["RMB", "USD", "BDT"] as const

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier's name").max(160),
  country: optText(80),
  contactPerson: optText(120),
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
  /** beneficiary bank, SWIFT, account — printed on LC documents */
  bankDetails: optText(2000),
  currency: z.enum(SUPPLIER_CURRENCIES).default("RMB"),
  /** BDT payable carried over from before TexonPOS; only used on create (posts an "opening" ledger credit) */
  openingBalance: z.coerce.number({ error: "Enter an amount" }).min(0, "Cannot be negative").max(1e12).default(0),
  notes: optText(2000),
  status: z.enum(["active", "inactive"]).default("active"),
})
export type SupplierInput = z.input<typeof supplierSchema>
export type SupplierOutput = z.output<typeof supplierSchema>
