import "server-only"
import type { z } from "zod"
import { prisma, type TenantDb } from "@/server/db"
import { AppError, businessRule, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import { hashPassword, verifyPassword } from "@/server/auth/crypto"
import { revokeAllSessions } from "@/server/auth/session"
import type { TenantContext } from "@/server/auth/context"
import { ALL_PERMISSION_KEYS } from "@/lib/permissions"
import type { branchSchema, companySchema, employeeSchema, roleSchema } from "@/lib/validation/org"

type Branch = z.output<typeof branchSchema>
type Employee = z.output<typeof employeeSchema>
type Role = z.output<typeof roleSchema>
type Company = z.output<typeof companySchema>

// ───────── Branches (ORG-01) ─────────

export async function createBranch(ctx: TenantContext, db: TenantDb, input: Branch) {
  const used = await db.branch.count({ where: { status: "active" } })
  if (used >= ctx.plan.maxBranches)
    throw new AppError("PLAN_LIMIT", `Your ${ctx.plan.name} plan allows ${ctx.plan.maxBranches} branch(es). Upgrade to add more.`, {
      limit: ctx.plan.maxBranches,
    })
  const branch = await db.branch.create({ data: { ...input, companyId: ctx.companyId } })
  await audit(ctx, { action: "create", entityType: "branch", entityId: branch.id, summary: `Created branch ${branch.name}`, after: branch })
  return branch
}

export async function updateBranch(ctx: TenantContext, db: TenantDb, id: string, input: Branch) {
  const before = await db.branch.findFirst({ where: { id } })
  if (!before) throw notFound("Branch")
  if (before.isHeadOffice && input.status === "inactive") throw businessRule("The head office branch cannot be deactivated.")
  if (before.status === "inactive" && input.status === "active") {
    const used = await db.branch.count({ where: { status: "active" } })
    if (used >= ctx.plan.maxBranches) throw new AppError("PLAN_LIMIT", "Branch limit reached for your plan.")
  }
  const branch = await db.branch.update({ where: { id }, data: input })
  await audit(ctx, { action: "update", entityType: "branch", entityId: id, summary: `Updated branch ${branch.name}`, before, after: branch })
  return branch
}

// ───────── Employees (ORG-02, ORG-03) ─────────

async function checkRoleAndBranches(db: TenantDb, input: Employee) {
  const role = await db.role.findFirst({ where: { id: input.roleId } })
  if (!role) throw new AppError("VALIDATION_ERROR", "Choose a valid role", { fields: { roleId: "Invalid role" } })
  if (input.branchIds.length) {
    const n = await db.branch.count({ where: { id: { in: input.branchIds } } })
    if (n !== input.branchIds.length) throw new AppError("VALIDATION_ERROR", "Invalid branch selection")
  }
  if (!input.allBranches && !input.branchIds.length)
    throw new AppError("VALIDATION_ERROR", "Assign at least one branch", { fields: { branchIds: "Assign at least one branch" } })
  return role
}

const employeeData = (input: Employee) => ({
  name: input.name,
  email: input.email,
  phone: input.phone,
  roleId: input.roleId,
  allBranches: input.allBranches,
  employeeCode: input.employeeCode,
  designation: input.designation,
  joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
  salary: input.salary ?? null,
  status: input.status,
})

export async function createEmployee(ctx: TenantContext, db: TenantDb, input: Employee) {
  if (!input.password) throw new AppError("VALIDATION_ERROR", "Set an initial password", { fields: { password: "Required" } })
  const active = await db.user.count({ where: { status: "active" } })
  if (active >= ctx.plan.maxEmployees)
    throw new AppError("PLAN_LIMIT", `Your ${ctx.plan.name} plan allows ${ctx.plan.maxEmployees} team members. Upgrade to add more.`)
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }))
    throw new AppError("CONFLICT", "This email is already in use", { fields: { email: "Already in use" } })
  await checkRoleAndBranches(db, input)
  const code = input.employeeCode ?? `EMP-${String((await db.user.count()) + 1).padStart(4, "0")}`
  const user = await db.user.create({
    data: {
      ...employeeData(input),
      employeeCode: code,
      companyId: ctx.companyId,
      passwordHash: await hashPassword(input.password),
      branches: { create: input.branchIds.map((branchId) => ({ branchId })) },
    },
  })
  await audit(ctx, { action: "create", entityType: "user", entityId: user.id, summary: `Added employee ${user.name}` })
  return { id: user.id }
}

export async function updateEmployee(ctx: TenantContext, db: TenantDb, id: string, input: Employee) {
  const before = await db.user.findFirst({ where: { id }, include: { branches: true } })
  if (!before) throw notFound("Employee")
  if (before.isOwner && (input.status === "inactive" || input.roleId !== before.roleId))
    throw businessRule("The company owner's role and status cannot be changed.")
  if (id === ctx.userId && input.status === "inactive") throw businessRule("You cannot deactivate your own account.")
  if (input.email !== before.email && (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })))
    throw new AppError("CONFLICT", "This email is already in use", { fields: { email: "Already in use" } })
  if (before.status === "inactive" && input.status === "active") {
    const active = await db.user.count({ where: { status: "active" } })
    if (active >= ctx.plan.maxEmployees) throw new AppError("PLAN_LIMIT", "Team member limit reached for your plan.")
  }
  await checkRoleAndBranches(db, input)
  await prisma.$transaction(async (tx) => {
    await tx.userBranch.deleteMany({ where: { userId: id } })
    await tx.user.update({
      where: { id },
      data: {
        ...employeeData(input),
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
        branches: { create: input.branchIds.map((branchId) => ({ branchId })) },
      },
    })
  })
  // ORG-03: deactivation (or a password change) revokes access immediately
  if (input.status === "inactive" || input.password) await revokeAllSessions("user", id)
  await audit(ctx, {
    action: "update",
    entityType: "user",
    entityId: id,
    summary: `Updated employee ${input.name}${input.status !== before.status ? ` (${input.status})` : ""}`,
    before: { roleId: before.roleId, status: before.status, branches: before.branches.map((b) => b.branchId) },
    after: { roleId: input.roleId, status: input.status, branches: input.branchIds },
  })
}

// ───────── Roles (AUTH-02) ─────────

async function permissionIds(keys: string[]) {
  const valid = keys.filter((k) => ALL_PERMISSION_KEYS.includes(k))
  const rows = await prisma.permission.findMany({ where: { key: { in: valid } }, select: { id: true } })
  return rows.map((r) => r.id)
}

export async function createRole(ctx: TenantContext, db: TenantDb, input: Role) {
  const ids = await permissionIds(input.permissions)
  const role = await db.role.create({
    data: {
      companyId: ctx.companyId,
      name: input.name,
      description: input.description,
      permissions: { create: ids.map((permissionId) => ({ permissionId })) },
    },
  })
  await audit(ctx, { action: "create", entityType: "role", entityId: role.id, summary: `Created role ${role.name}`, after: input })
  return role
}

export async function updateRole(ctx: TenantContext, db: TenantDb, id: string, input: Role) {
  const before = await db.role.findFirst({ where: { id }, include: { permissions: { include: { permission: true } } } })
  if (!before) throw notFound("Role")
  if (before.key === "owner") throw businessRule("The Company Owner role always has full access and cannot be edited.")
  const ids = await permissionIds(input.permissions)
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.role.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        permissions: { create: ids.map((permissionId) => ({ permissionId })) },
      },
    }),
  ])
  await audit(ctx, {
    action: "update",
    entityType: "role",
    entityId: id,
    summary: `Updated role ${input.name}`,
    before: before.permissions.map((p) => p.permission.key),
    after: input.permissions,
  })
}

export async function deleteRole(ctx: TenantContext, db: TenantDb, id: string) {
  const role = await db.role.findFirst({ where: { id }, include: { _count: { select: { users: true } } } })
  if (!role) throw notFound("Role")
  if (role.isSystem) throw businessRule("System roles cannot be deleted.")
  if (role._count.users) throw businessRule(`${role._count.users} employee(s) still use this role. Reassign them first.`)
  await db.role.delete({ where: { id } })
  await audit(ctx, { action: "delete", entityType: "role", entityId: id, summary: `Deleted role ${role.name}` })
}

// ───────── Company & profile ─────────

export async function updateCompany(ctx: TenantContext, input: Company) {
  const before = await prisma.company.findUnique({ where: { id: ctx.companyId } })
  const { cancelWindowHours, ...fields } = input
  const settings = { ...((before?.settings as Record<string, unknown> | null) ?? {}), cancelWindowHours }
  const after = await prisma.company.update({ where: { id: ctx.companyId }, data: { ...fields, settings } })
  await audit(ctx, { action: "update", entityType: "company", entityId: ctx.companyId, summary: "Updated company profile", before, after })
  return after
}

export async function changePassword(ctx: TenantContext, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } })
  if (!(await verifyPassword(current, user.passwordHash)))
    throw new AppError("VALIDATION_ERROR", "Current password is incorrect", { fields: { current: "Incorrect password" } })
  await prisma.user.update({ where: { id: ctx.userId }, data: { passwordHash: await hashPassword(next) } })
  await prisma.authSession.updateMany({
    where: { subjectType: "user", subjectId: ctx.userId, revokedAt: null, NOT: { id: ctx.sessionId } },
    data: { revokedAt: new Date() },
  })
}
