import { z } from "zod"

export const notificationPrefsSchema = z.object({
  lowStock: z.boolean(),
  lcArrival: z.boolean(),
  overdueCredit: z.boolean(),
  subscription: z.boolean(),
  email: z.boolean(),
  creditDueDays: z.coerce.number().int("Whole days only").min(1, "At least 1 day").max(365, "At most 365 days"),
})

export const markReadSchema = z
  .object({
    ids: z.array(z.string().min(1).max(40)).max(200).optional(),
    all: z.literal(true).optional(),
  })
  .refine((v) => v.all || (v.ids && v.ids.length > 0), { message: "Pass ids or all: true" })

export const languageSchema = z.object({ lang: z.enum(["en", "bn"]) })
