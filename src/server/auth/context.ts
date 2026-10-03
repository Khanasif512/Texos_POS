import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/server/db"
import { AppError, forbidden } from "@/server/errors"
import type { PlanFeatures } from "@/lib/permissions"
import { COOKIES } from "./cookies"
import { verifyAccessToken } from "./jwt"

export type TenantContext = {
  userId: string
  companyId: string
  sessionId: string
  name: string
  email: string
  avatarUrl: string | null
  isOwner: boolean
  roleName: string
  permissions: Set<string>
  allBranches: boolean
  branches: { id: string; name: string; code: string; isHeadOffice: boolean }[]
  branchIds: string[]
  activeBranchId: string
  company: { id: string; name: string; slug: string; status: string; logoUrl: string | null; currency: string }
  plan: {
    code: string
    name: string
    maxBranches: number
    maxEmployees: number
    maxProducts: number | null
    features: PlanFeatures
  }
  subscription: {
    id: string
    status: string
    trialEndsAt: Date | null
    currentPeriodEnd: Date | null
    graceEndsAt: Date | null
  } | null
  /** TEN-05: lapsed subscription / suspended company → only billing & reads allowed */
  readOnly: boolean
  readOnlyReason: string | null
  impersonatorId: string | null
}

type LoadResult = { ctx: TenantContext } | { error: "none" | "expired" | "invalid" }

const EMPTY_FEATURES: PlanFeatures = {
  lc: false,
  purchase: false,
  crm: false,
  advancedReports: false,
  multiBranchTransfer: false,
  export: false,
  prioritySupport: false,
}

const loadContext = cache(async (): Promise<LoadResult> => {
  const jar = await cookies()
  const v = await verifyAccessToken(jar.get(COOKIES.user.access)?.value)
  if (!v.ok) return { error: v.expired || jar.has(COOKIES.user.refresh) ? "expired" : "none" }
  const { sub, sid, imp } = v.claims
  if (v.claims.typ !== "user") return { error: "invalid" }

  const [user, session] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sub },
      include: {
        role: { include: { permissions: { include: { permission: { select: { key: true } } } } } },
        branches: { select: { branchId: true } },
        company: {
          include: {
            subscriptions: { where: { isCurrent: true }, include: { plan: true }, take: 1 },
            branches: { where: { status: "active" }, orderBy: [{ isHeadOffice: "desc" }, { name: "asc" }] },
          },
        },
      },
    }),
    prisma.authSession.findUnique({ where: { id: sid }, select: { revokedAt: true } }),
  ])
  if (!user || user.status !== "active" || !session || session.revokedAt) return { error: "invalid" }

  const company = user.company
  const current = company.subscriptions[0] ?? null
  const isOwner = user.isOwner || user.role.key === "owner"
  const allBranches = isOwner || user.allBranches
  const assigned = new Set(user.branches.map((b) => b.branchId))
  const branches = company.branches
    .filter((b) => allBranches || assigned.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, code: b.code, isHeadOffice: b.isHeadOffice }))
  const preferred = jar.get(COOKIES.branch)?.value
  const activeBranchId = branches.find((b) => b.id === preferred)?.id ?? branches[0]?.id ?? ""

  const now = new Date()
  let readOnlyReason: string | null = null
  if (company.status === "suspended") readOnlyReason = "Your workspace has been suspended. Please contact support."
  else if (company.status === "cancelled") readOnlyReason = "Your subscription is cancelled. Data is read-only."
  else if (current?.status === "trialing" && current.trialEndsAt && current.trialEndsAt < now)
    readOnlyReason = "Your free trial has ended. Choose a plan to continue."
  else if (current?.status === "past_due" && current.graceEndsAt && current.graceEndsAt < now)
    readOnlyReason = "Payment is overdue. Settle your invoice to restore full access."
  else if (!current || current.status === "expired" || current.status === "cancelled")
    readOnlyReason = "Your subscription is not active."

  const plan = current?.plan
  return {
    ctx: {
      userId: user.id,
      companyId: company.id,
      sessionId: sid,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isOwner,
      roleName: user.role.name,
      permissions: new Set(user.role.permissions.map((rp) => rp.permission.key)),
      allBranches,
      branches,
      branchIds: branches.map((b) => b.id),
      activeBranchId,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
        logoUrl: company.logoUrl,
        currency: company.currency,
      },
      plan: plan
        ? {
            code: plan.code,
            name: plan.name,
            maxBranches: plan.maxBranches,
            maxEmployees: plan.maxEmployees,
            maxProducts: plan.maxProducts,
            features: { ...EMPTY_FEATURES, ...(plan.features as Partial<PlanFeatures>) },
          }
        : { code: "none", name: "No plan", maxBranches: 1, maxEmployees: 1, maxProducts: 0, features: EMPTY_FEATURES },
      subscription: current
        ? {
            id: current.id,
            status: current.status,
            trialEndsAt: current.trialEndsAt,
            currentPeriodEnd: current.currentPeriodEnd,
            graceEndsAt: current.graceEndsAt,
          }
        : null,
      readOnly: readOnlyReason !== null,
      readOnlyReason,
      impersonatorId: imp ?? null,
    },
  }
})

/** For Server Components / layouts: redirect to login when there is no valid session. */
export async function requireTenant(nextPath = "/app"): Promise<TenantContext> {
  const r = await loadContext()
  if ("ctx" in r) return r.ctx
  if (r.error === "expired") redirect(`/api/v1/auth/refresh?next=${encodeURIComponent(nextPath)}`)
  redirect(`/login?next=${encodeURIComponent(nextPath)}`)
}

export async function getTenantOrNull() {
  const r = await loadContext()
  return "ctx" in r ? r.ctx : null
}

/** For route handlers: throws envelope-friendly errors. */
export async function tenantFromRequest(): Promise<TenantContext> {
  const r = await loadContext()
  if ("ctx" in r) return r.ctx
  if (r.error === "expired") throw new AppError("TOKEN_EXPIRED", "Session expired")
  throw new AppError("UNAUTHENTICATED", "Please sign in")
}

export const can = (ctx: TenantContext, perm: string) => ctx.isOwner || ctx.permissions.has(perm)

/** Passes when the user holds at least one of the given permissions. */
export function requirePermission(ctx: TenantContext, ...perms: string[]) {
  if (!perms.some((p) => can(ctx, p))) throw forbidden()
}

/** Page guard: sends users without permission to a friendly 403 page instead of an error boundary. */
export function ensurePermission(ctx: TenantContext, ...perms: string[]) {
  if (!perms.some((p) => can(ctx, p))) redirect("/app/forbidden")
}

/** AUTH-03: branch scope check. */
export function assertBranch(ctx: TenantContext, branchId: string | null | undefined) {
  if (!branchId || !ctx.branchIds.includes(branchId)) throw forbidden("You do not have access to this branch")
}

export function assertWritable(ctx: TenantContext) {
  if (ctx.readOnly) throw new AppError("SUBSCRIPTION_INACTIVE", ctx.readOnlyReason ?? "Workspace is read-only")
}

/** TEN-03: plan feature gate, enforced server-side. */
export function assertFeature(ctx: TenantContext, feature: keyof PlanFeatures) {
  if (!ctx.plan.features[feature])
    throw new AppError("FEATURE_LOCKED", `This feature is not included in the ${ctx.plan.name} plan. Upgrade to unlock it.`, {
      feature,
    })
}

/** Branch filter for list queries: a requested branch (validated) or all permitted branches. */
export function branchFilter(ctx: TenantContext, requested?: string | null) {
  if (requested && requested !== "all") {
    assertBranch(ctx, requested)
    return { branchId: requested }
  }
  return { branchId: { in: ctx.branchIds } }
}

/** Serializable subset passed to client components. */
export function publicContext(ctx: TenantContext) {
  return {
    userId: ctx.userId,
    name: ctx.name,
    email: ctx.email,
    avatarUrl: ctx.avatarUrl,
    isOwner: ctx.isOwner,
    roleName: ctx.roleName,
    permissions: ctx.isOwner ? ["*"] : [...ctx.permissions],
    branches: ctx.branches,
    activeBranchId: ctx.activeBranchId,
    allBranches: ctx.allBranches,
    company: ctx.company,
    plan: ctx.plan,
    subscription: ctx.subscription,
    readOnly: ctx.readOnly,
    readOnlyReason: ctx.readOnlyReason,
    impersonating: ctx.impersonatorId !== null,
  }
}
export type PublicContext = ReturnType<typeof publicContext>
