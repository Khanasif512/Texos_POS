import "server-only"
import { prisma } from "@/server/db"
import { AppError, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import type { AdminContext } from "@/server/auth/admin-context"
import { issueSession } from "@/server/auth/session"
import { dec, num } from "@/server/decimal"
import type { PlanFeatures } from "@/lib/permissions"
import { addPeriod, mrrSeries, retentionEndsAt } from "./lifecycle"
import { PLATFORM_SETTINGS, getBillingSettings } from "./settings"

const DAY = 86_400_000

export async function platformOverview() {
  const now = new Date()
  const monthAgo = new Date(now.getTime() - 30 * DAY)
  const [companies, byStatus, subs, newCompanies, users] = await Promise.all([
    prisma.company.count(),
    prisma.company.groupBy({ by: ["status"], _count: true }),
    prisma.subscription.findMany({ where: { isCurrent: true }, include: { plan: true } }),
    prisma.company.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { status: "active" } }),
  ])
  const active = subs.filter((s) => s.status === "active")
  const mrr = active.reduce(
    (sum, s) => sum + (s.billingCycle === "yearly" ? Number(s.plan.priceYearly) / 12 : Number(s.plan.priceMonthly)),
    0,
  )
  const trialing = subs.filter((s) => s.status === "trialing").length
  const everPaid = new Set((await prisma.billingInvoice.groupBy({ by: ["companyId"], where: { status: "paid" } })).map((g) => g.companyId))
  // conversion is measured over companies whose trial is decided: paid at least once, or trial over
  const decided = subs.filter((s) => everPaid.has(s.companyId) || s.status !== "trialing" || (s.trialEndsAt && s.trialEndsAt < now)).length
  const converted = subs.filter((s) => everPaid.has(s.companyId)).length
  const churned = subs.filter(
    (s) => (s.status === "cancelled" || s.status === "expired") && everPaid.has(s.companyId) && s.updatedAt >= monthAgo,
  ).length
  return {
    companies,
    statusCounts: Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Record<string, number>,
    mrr,
    paying: active.length,
    trialing,
    newCompanies,
    users,
    conversion: decided ? (converted / decided) * 100 : 0,
    converted,
    decided,
    churned,
    churnRate: active.length + churned ? (churned / (active.length + churned)) * 100 : 0,
  }
}

async function currentSub(companyId: string) {
  const sub = await prisma.subscription.findFirst({ where: { companyId, isCurrent: true } })
  if (!sub) throw notFound("Subscription")
  return sub
}

/** TEN-04: Super Admin manual overrides. */
export async function setCompanyStatus(admin: AdminContext, companyId: string, status: "active" | "suspended") {
  const c = await prisma.company.findUnique({ where: { id: companyId } })
  if (!c) throw notFound("Company")
  await prisma.company.update({ where: { id: companyId }, data: { status } })
  if (status === "suspended") {
    const users = await prisma.user.findMany({ where: { companyId }, select: { id: true } })
    await prisma.authSession.updateMany({
      where: { subjectType: "user", subjectId: { in: users.map((u) => u.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  await audit({ admin, companyId }, { action: status === "suspended" ? "suspend" : "reactivate", entityType: "company", entityId: companyId, summary: `${status === "suspended" ? "Suspended" : "Reactivated"} ${c.name}` })
}

export async function extendTrial(admin: AdminContext, companyId: string, days: number) {
  if (days < 1 || days > 365) throw new AppError("VALIDATION_ERROR", "Days must be between 1 and 365")
  const sub = await currentSub(companyId)
  const base = sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date()
  const trialEndsAt = new Date(base.getTime() + days * DAY)
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "trialing", trialEndsAt } })
  await prisma.company.updateMany({ where: { id: companyId, status: { in: ["cancelled"] } }, data: { status: "trial" } })
  await audit({ admin, companyId }, { action: "extend_trial", entityType: "subscription", entityId: sub.id, summary: `Extended trial by ${days} days`, after: { trialEndsAt } })
}

export async function changePlan(admin: AdminContext, companyId: string, planId: string, activate: boolean, cycle: "monthly" | "yearly") {
  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) throw notFound("Plan")
  const sub = await currentSub(companyId)
  const now = new Date()
  const periodEnd = addPeriod(now, cycle)
  await prisma.subscription.update({
    where: { id: sub.id },
    data: activate
      ? { planId, status: "active", billingCycle: cycle, currentPeriodStart: now, currentPeriodEnd: periodEnd, graceEndsAt: null }
      : { planId },
  })
  if (activate) await prisma.company.update({ where: { id: companyId }, data: { status: "active" } })
  await audit({ admin, companyId }, { action: "change_plan", entityType: "subscription", entityId: sub.id, summary: `Plan set to ${plan.name}${activate ? ` (activated, ${cycle})` : ""}` })
}

/** Support impersonation: signs the admin in as the company owner; audited and flagged in the session. */
export async function impersonate(admin: AdminContext, companyId: string) {
  const owner = await prisma.user.findFirst({ where: { companyId, isOwner: true, status: "active" } })
  if (!owner) throw notFound("Active owner")
  await audit({ admin, companyId }, { action: "impersonate", entityType: "company", entityId: companyId, summary: `Support session as ${owner.email}` })
  await issueSession("user", owner.id, { cid: companyId, imp: admin.id })
}

// ───────────────────────────── Billing analytics (§7: MRR, churn, conversion) ─────────────────────────────

export async function billingOverview(now = new Date()) {
  const since = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth() - 1, 1))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [paid, month, outstanding, overdue, subs, flagged] = await Promise.all([
    prisma.billingInvoice.findMany({
      where: { status: "paid", OR: [{ periodEnd: { gte: since } }, { paidAt: { gte: since } }] },
      select: { amount: true, periodStart: true, periodEnd: true, paidAt: true },
    }),
    prisma.billingInvoice.aggregate({ where: { status: "paid", paidAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.billingInvoice.aggregate({ where: { status: "unpaid" }, _sum: { amount: true }, _count: true }),
    prisma.billingInvoice.count({ where: { status: "unpaid", dueAt: { lt: now } } }),
    prisma.subscription.findMany({ where: { isCurrent: true }, include: { plan: { select: { name: true, sortOrder: true } } } }),
    prisma.auditLog.findMany({ where: { action: "retention_expired" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ])

  const byPlan = new Map<string, { plan: string; sortOrder: number; paying: number; trialing: number; other: number }>()
  for (const s of subs) {
    const row = byPlan.get(s.plan.name) ?? { plan: s.plan.name, sortOrder: s.plan.sortOrder, paying: 0, trialing: 0, other: 0 }
    if (s.status === "active" || s.status === "past_due") row.paying++
    else if (s.status === "trialing") row.trialing++
    else row.other++
    byPlan.set(s.plan.name, row)
  }

  // retention-expired companies that are still cancelled (a resumed tenant drops off the list)
  const companyIds = [...new Set(flagged.map((f) => f.companyId).filter((v): v is string => !!v))]
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds }, status: "cancelled" },
    select: { id: true, name: true, email: true, subscriptions: { where: { isCurrent: true }, select: { cancelledAt: true, currentPeriodEnd: true } } },
  })
  const retention = companies.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    cancelledAt: c.subscriptions[0]?.cancelledAt ?? null,
    retentionEndedAt: c.subscriptions[0] ? retentionEndsAt(c.subscriptions[0]) : null,
  }))

  return {
    mrrTrend: mrrSeries(
      paid.map((p) => ({ amount: num(p.amount), periodStart: p.periodStart, periodEnd: p.periodEnd, paidAt: p.paidAt })),
      now,
    ),
    planDistribution: [...byPlan.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    revenueThisMonth: num(month._sum.amount),
    paymentsThisMonth: month._count,
    outstandingAmount: num(outstanding._sum.amount),
    outstandingCount: outstanding._count,
    overdueCount: overdue,
    retention,
  }
}

// ───────────────────────────── Plans (TEN-03: changes apply to tenants immediately via ctx.plan) ─────────────────────────────

export async function savePlan(
  admin: AdminContext,
  id: string | null,
  input: {
    code: string
    name: string
    tagline: string | null
    priceMonthly: number
    priceYearly: number
    maxBranches: number
    maxEmployees: number
    maxProducts: number | null
    features: PlanFeatures
    isPublic: boolean
    isDefaultTrial: boolean
    sortOrder: number
    status: "active" | "inactive"
  },
) {
  if (input.isDefaultTrial && input.status !== "active")
    throw new AppError("VALIDATION_ERROR", "The trial plan must be active", { fields: { isDefaultTrial: "Only an active plan can be the trial plan" } })
  const before = id ? await prisma.plan.findUnique({ where: { id } }) : null
  if (id && !before) throw notFound("Plan")
  const clash = await prisma.plan.findFirst({ where: { code: input.code, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })
  if (clash) throw new AppError("VALIDATION_ERROR", "Plan code already used", { fields: { code: "Another plan uses this code" } })
  if (before?.isDefaultTrial && !input.isDefaultTrial)
    throw new AppError("VALIDATION_ERROR", "Choose another trial plan first", {
      fields: { isDefaultTrial: "New companies need a trial plan — mark another plan as the trial plan instead" },
    })

  const data = {
    code: input.code,
    name: input.name,
    tagline: input.tagline,
    priceMonthly: dec(input.priceMonthly),
    priceYearly: dec(input.priceYearly),
    maxBranches: input.maxBranches,
    maxEmployees: input.maxEmployees,
    maxProducts: input.maxProducts,
    features: input.features,
    isPublic: input.isPublic,
    isDefaultTrial: input.isDefaultTrial,
    sortOrder: input.sortOrder,
    status: input.status,
  }
  const plan = await prisma.$transaction(async (tx) => {
    if (input.isDefaultTrial) await tx.plan.updateMany({ where: { isDefaultTrial: true, ...(id ? { id: { not: id } } : {}) }, data: { isDefaultTrial: false } })
    const saved = id ? await tx.plan.update({ where: { id }, data }) : await tx.plan.create({ data })
    await audit(
      { admin },
      {
        action: id ? "update" : "create",
        entityType: "plan",
        entityId: saved.id,
        summary: `${id ? "Updated" : "Created"} plan ${saved.name}`,
        before: before ?? undefined,
        after: saved,
      },
      tx,
    )
    return saved
  })
  const tenants = await prisma.subscription.count({ where: { planId: plan.id, isCurrent: true } })
  return { id: plan.id, tenants }
}

// ───────────────────────────── Platform settings & inbox ─────────────────────────────

export async function savePlatformSettings(admin: AdminContext, input: { trialDays: number; graceDays: number; instructions: string }) {
  const before = await getBillingSettings()
  const rows: [string, string | number][] = [
    [PLATFORM_SETTINGS.trialDays.key, input.trialDays],
    [PLATFORM_SETTINGS.graceDays.key, input.graceDays],
    [PLATFORM_SETTINGS.instructions.key, input.instructions],
  ]
  await prisma.$transaction(rows.map(([key, value]) => prisma.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } })))
  await audit({ admin }, { action: "update", entityType: "platform_settings", summary: "Updated billing settings", before, after: input })
}

export async function setMessageHandled(admin: AdminContext, id: string, handled: boolean) {
  const m = await prisma.contactMessage.findUnique({ where: { id } })
  if (!m) throw notFound("Message")
  await prisma.contactMessage.update({ where: { id }, data: { handled } })
  await audit({ admin }, { action: handled ? "handled" : "reopened", entityType: "contact_message", entityId: id, summary: `Contact message from ${m.name} marked ${handled ? "handled" : "open"}` })
}
