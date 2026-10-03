import { z } from "zod"
import { passwordSchema } from "./public"

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null)

export const branchSchema = z.object({
  name: z.string().trim().min(2, "Enter a branch name").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "2–12 letters/numbers")
    .max(12)
    .regex(/^[A-Z0-9-]+$/, "Letters, numbers and dashes only"),
  address: optText(500),
  phone: optText(40),
  status: z.enum(["active", "inactive"]).default("active"),
})
export type BranchInput = z.input<typeof branchSchema>
export type BranchOutput = z.output<typeof branchSchema>

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Enter the employee's name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(191),
  phone: optText(40),
  roleId: z.string().min(1, "Choose a role"),
  branchIds: z.array(z.string()).default([]),
  allBranches: z.boolean().default(false),
  employeeCode: optText(30),
  designation: optText(80),
  joiningDate: optText(10),
  salary: z.coerce.number().min(0).max(1e12).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  /** required on create, optional on update (sets a new password) */
  password: passwordSchema.optional().or(z.literal("")).transform((v) => v || undefined),
})
export type EmployeeInput = z.input<typeof employeeSchema>
export type EmployeeOutput = z.output<typeof employeeSchema>

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name").max(80),
  description: optText(255),
  permissions: z.array(z.string()).default([]),
})
export type RoleInput = z.input<typeof roleSchema>
export type RoleOutput = z.output<typeof roleSchema>

export const companySchema = z.object({
  name: z.string().trim().min(2).max(160),
  businessType: optText(80),
  email: z.string().trim().toLowerCase().email().max(191),
  phone: optText(40),
  address: optText(1000),
  tradeLicense: optText(80),
  binNumber: optText(80),
  invoiceFooter: optText(1000),
})
export type CompanyInput = z.input<typeof companySchema>
export type CompanyOutput = z.output<typeof companySchema>

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optText(40),
})

export const changePasswordSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
