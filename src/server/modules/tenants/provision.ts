// No "server-only" import: also used by prisma/seed.ts (run with tsx).
import type { Prisma, PrismaClient } from "@/generated/prisma/client"
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "@/lib/permissions"

type Db = PrismaClient | Prisma.TransactionClient

export const TRIAL_DAYS = 14

export const DEFAULT_EXPENSE_CATEGORIES: { name: string; lcCostType?: Prisma.ExpenseCategoryCreateInput["lcCostType"] }[] = [
  { name: "Office Rent" },
  { name: "Warehouse Rent" },
  { name: "Staff Salary", lcCostType: "staff_salary" },
  { name: "Entertainment", lcCostType: "entertainment" },
  { name: "Utility Bills" },
  { name: "Delivery Charge", lcCostType: "delivery" },
  { name: "Transport", lcCostType: "transport" },
  { name: "Customs Duty", lcCostType: "customs_duty" },
  { name: "Other", lcCostType: "other" },
]

export function slugify(v: string) {
  return (
    v
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "company"
  )
}

/** Idempotently make sure every permission in the catalog exists. Returns key → id. */
export async function syncPermissions(db: Db) {
  const existing = await db.permission.findMany({ select: { id: true, key: true } })
  const have = new Set(existing.map((p) => p.key))
  const missing = ALL_PERMISSIONS.filter((p) => !have.has(p.key))
  if (missing.length) {
    await db.permission.createMany({
      data: missing.map((p) => ({ key: p.key, module: p.module, action: p.action, description: p.label })),
      skipDuplicates: true,
    })
  }
  const all = await db.permission.findMany({ select: { id: true, key: true } })
  return new Map(all.map((p) => [p.key, p.id]))
}

export type ProvisionInput = {
  companyName: string
  email: string
  ownerName: string
  phone?: string | null
  passwordHash: string
  businessType?: string | null
  planCode?: string
}

/**
 * TEN-01: creates Company + Head Office branch + system roles (AUTH-02) + owner user
 * + default expense categories (EXP-01) + trial subscription (TEN-02). Call inside a transaction.
 */
export async function provisionCompany(db: Db, input: ProvisionInput) {
  const permIds = await syncPermissions(db)

  const base = slugify(input.companyName)
  let slug = base
  for (let i = 2; await db.company.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`

  const company = await db.company.create({
    data: {
      name: input.companyName,
      slug,
      email: input.email,
      phone: input.phone ?? null,
      businessType: input.businessType ?? null,
      status: "trial",
    },
  })

  const headOffice = await db.branch.create({
    data: { companyId: company.id, code: "HO", name: "Head Office", isHeadOffice: true, phone: input.phone ?? null },
  })

  let ownerRoleId = ""
  for (const r of SYSTEM_ROLES) {
    const role = await db.role.create({
      data: {
        companyId: company.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: true,
        permissions: {
          create: r.permissions.filter((k) => permIds.has(k)).map((k) => ({ permissionId: permIds.get(k)! })),
        },
      },
    })
    if (r.key === "owner") ownerRoleId = role.id
  }

  const owner = await db.user.create({
    data: {
      companyId: company.id,
      roleId: ownerRoleId,
      name: input.ownerName,
      email: input.email,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      isOwner: true,
      allBranches: true,
      employeeCode: "EMP-0001",
      designation: "Owner",
      branches: { create: { branchId: headOffice.id } },
    },
  })

  await db.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
      companyId: company.id,
      name: c.name,
      isSystem: true,
      lcCostType: c.lcCostType ?? null,
    })),
  })

  const plan =
    (input.planCode && (await db.plan.findUnique({ where: { code: input.planCode } }))) ||
    (await db.plan.findFirst({ where: { isDefaultTrial: true, status: "active" } })) ||
    (await db.plan.findFirst({ where: { status: "active" }, orderBy: { sortOrder: "asc" } }))
  if (!plan) throw new Error("No subscription plan configured. Run the seed first.")

  const now = new Date()
  await db.subscription.create({
    data: {
      companyId: company.id,
      planId: plan.id,
      status: "trialing",
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000),
      currentPeriodStart: now,
      isCurrent: true,
    },
  })

  return { company, owner, headOffice }
}
