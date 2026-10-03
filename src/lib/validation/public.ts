import { z } from "zod"

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(191)
const phone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+\d][\d\s-]{5,}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""))

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(100)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number")

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email,
  phone,
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(4000),
})
export type ContactInput = z.infer<typeof contactSchema>

export const signupSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name").max(160),
  ownerName: z.string().trim().min(2, "Enter your full name").max(120),
  email,
  phone,
  password: passwordSchema,
  plan: z.string().max(40).optional(),
})
export type SignupInput = z.infer<typeof signupSchema>

export const verifySchema = z.object({
  verificationId: z.string().min(10),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(100),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotSchema = z.object({ email })
export const resetSchema = z
  .object({ token: z.string().min(20), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
