import "server-only"
import { prisma } from "@/server/db"
import { AppError, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import type { AdminContext } from "@/server/auth/admin-context"
import { issueSession } from "@/server/auth/session"

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
  const everPaid = await prisma.billingInvoice.groupBy({ by: ["companyId"], where: { status: "paid" } })
  const churned = subs.filter((s) => s.status === "cancelled" && s.cancelledAt && s.cancelledAt >= monthAgo).length
  return {
    companies,
    statusCounts: Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Record<string, number>,
    mrr,
    paying: active.length,
    trialing,
    newCompanies,
    users,
    conversion: companies ? (everPaid.length / companies) * 100 : 0,
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
  const periodEnd = new Date(now)
  if (cycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  else periodEnd.setMonth(periodEnd.getMonth() + 1)
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
