import "server-only"
import { prisma } from "@/server/db"
import type { Prisma } from "@/generated/prisma/client"
import { dec } from "@/server/decimal"
import { date, money } from "@/lib/format"
import { cycleLabel, nextBillingNumber, notifyCompany, systemAudit, type InvoiceMeta } from "./billing"
import { decideSubscriptionAction, type JobAction, type SubState } from "./lifecycle"
import { getBillingSettings } from "./settings"

const SUB_INCLUDE = { plan: true, company: { select: { id: true, name: true } } } as const
type SubRow = Prisma.SubscriptionGetPayload<{ include: typeof SUB_INCLUDE }>

export type JobReport = {
  ranAt: string
  checked: number
  trialReminders: number
  trialsExpired: number
  renewalsInvoiced: number
  cancellationsEnded: number
  lapsed: number
  overdueNotices: number
  retentionExpired: number
  errors: { subscriptionId: string; message: string }[]
}

/** True the first time a notice with this exact marker is recorded (dedupes emails across hourly runs). */
async function firstTime(companyId: string, action: string, entityId: string, summary: string) {
  const seen = await prisma.auditLog.findFirst({ where: { companyId, action, entityId, summary }, select: { id: true } })
  if (seen) return false
  await systemAudit(prisma, companyId, { action, entityType: action === "retention_expired" ? "company" : "subscription", entityId, summary })
  return true
}

/**
 * TEN-02 / TEN-05 / §7 subscription lifecycle. Safe to run hourly and concurrently: every state change is
 * an update guarded by the state it was decided from, and notices are de-duplicated by an audit marker.
 *   trialing past trialEndsAt          → expired (ctx makes the workspace read-only)
 *   trial ends within 3 days           → reminder email (once per trial end date)
 *   active past period end + autoRenew → next unpaid invoice, past_due with grace period
 *   active past period end, cancelled  → cancelled (company cancelled, read-only retention starts)
 *   active past period end, no renew   → expired
 *   past_due past grace                → overdue email (once); ctx already blocks writes
 *   cancelled past 90-day retention    → "retention_expired" audit flag for the admin (data is NOT deleted)
 */
export async function runSubscriptionJobs(now = new Date()): Promise<JobReport> {
  const { graceDays } = await getBillingSettings()
  const subs = await prisma.subscription.findMany({
    where: { isCurrent: true, status: { in: ["trialing", "active", "past_due", "cancelled"] }, company: { status: { not: "suspended" } } },
    include: SUB_INCLUDE,
  })
  const report: JobReport = {
    ranAt: now.toISOString(),
    checked: subs.length,
    trialReminders: 0,
    trialsExpired: 0,
    renewalsInvoiced: 0,
    cancellationsEnded: 0,
    lapsed: 0,
    overdueNotices: 0,
    retentionExpired: 0,
    errors: [],
  }

  for (const sub of subs) {
    const action = decideSubscriptionAction(sub as SubState, now, { graceDays })
    if (!action) continue
    try {
      await apply(sub, action, report)
    } catch (e) {
      console.error("[billing-job]", sub.id, e)
      report.errors.push({ subscriptionId: sub.id, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return report
}


async function apply(sub: SubRow, action: JobAction, report: JobReport) {
  const companyId = sub.companyId
  switch (action.type) {
    case "trial_reminder": {
      if (!(await firstTime(companyId, "trial_reminder", sub.id, `Trial ending reminder (ends ${date(sub.trialEndsAt)})`))) return
      await notifyCompany(companyId, {
        type: "billing.trial_ending",
        subject: `Your TexonPOS trial ends in ${action.daysLeft} day${action.daysLeft === 1 ? "" : "s"}`,
        title: "Your free trial is ending soon",
        lines: [
          `Your free trial of the ${sub.plan.name} plan ends on ${date(sub.trialEndsAt)}.`,
          "Choose a plan before then to keep full access. After the trial your data stays safe but the workspace becomes read-only.",
        ],
      })
      report.trialReminders++
      return
    }

    case "expire_trial": {
      const r = await prisma.subscription.updateMany({ where: { id: sub.id, status: "trialing", trialEndsAt: sub.trialEndsAt }, data: { status: "expired" } })
      if (!r.count) return
      await systemAudit(prisma, companyId, { action: "trial_expired", entityType: "subscription", entityId: sub.id, summary: `Trial of ${sub.plan.name} expired` })
      await notifyCompany(companyId, {
        type: "billing.trial_expired",
        subject: "Your TexonPOS trial has ended",
        title: "Your free trial has ended",
        lines: ["Your workspace is now read-only. All your data is kept.", "Choose a plan to restore full access."],
      })
      report.trialsExpired++
      return
    }

    case "renew": {
      const amount = dec(sub.billingCycle === "yearly" ? sub.plan.priceYearly : sub.plan.priceMonthly)
      const meta: InvoiceMeta = { kind: "renewal", planId: sub.planId, planName: sub.plan.name, cycle: sub.billingCycle }
      const inv = await prisma.$transaction(async (tx) => {
        const r = await tx.subscription.updateMany({
          where: { id: sub.id, status: "active", currentPeriodEnd: sub.currentPeriodEnd },
          data: { status: "past_due", graceEndsAt: action.graceEndsAt },
        })
        if (!r.count) return null
        const dup = await tx.billingInvoice.findFirst({ where: { subscriptionId: sub.id, periodStart: action.periodStart, status: { in: ["unpaid", "paid"] } } })
        if (dup) return dup
        const number = await nextBillingNumber(tx)
        const created = await tx.billingInvoice.create({
          data: {
            companyId,
            subscriptionId: sub.id,
            number,
            description: `${sub.plan.name} plan · ${cycleLabel(sub.billingCycle)} renewal`,
            amount,
            status: "unpaid",
            periodStart: action.periodStart,
            periodEnd: action.periodEnd,
            dueAt: action.graceEndsAt,
            provider: "manual",
            kind: "renewal",
            planId: sub.planId,
            billingCycle: sub.billingCycle,
          },
        })
        await systemAudit(tx, companyId, {
          action: "create",
          entityType: "billing_invoice",
          entityId: created.id,
          summary: `Renewal invoice ${number} · ${money(amount)} · ${sub.plan.name} (${sub.billingCycle})`,
          after: { ...meta, number, amount: Number(amount) },
        })
        return created
      })
      if (!inv) return
      await notifyCompany(companyId, {
        type: "billing.invoice_issued",
        subject: `Invoice ${inv.number} — ${sub.plan.name} renewal`,
        title: `Renewal invoice ${inv.number}`,
        lines: [
          `Your ${sub.plan.name} plan renews for ${date(action.periodStart)} – ${date(action.periodEnd)}.`,
          `Amount due: ${money(inv.amount)} by ${date(action.graceEndsAt)}. Your workspace keeps full access until then.`,
        ],
      })
      report.renewalsInvoiced++
      return
    }

    case "end_cancelled": {
      const r = await prisma.subscription.updateMany({ where: { id: sub.id, status: "active", cancelledAt: { not: null } }, data: { status: "cancelled" } })
      if (!r.count) return
      await prisma.company.update({ where: { id: companyId }, data: { status: "cancelled" } })
      await systemAudit(prisma, companyId, { action: "cancellation_effective", entityType: "subscription", entityId: sub.id, summary: "Cancelled subscription ended; workspace read-only" })
      report.cancellationsEnded++
      return
    }

    case "lapse": {
      const r = await prisma.subscription.updateMany({ where: { id: sub.id, status: "active", autoRenew: false }, data: { status: "expired" } })
      if (!r.count) return
      await systemAudit(prisma, companyId, { action: "subscription_expired", entityType: "subscription", entityId: sub.id, summary: "Subscription expired (auto-renew off)" })
      await notifyCompany(companyId, {
        type: "billing.expired",
        subject: "Your TexonPOS subscription has expired",
        title: "Subscription expired",
        lines: ["Auto-renew was off, so your subscription ended and the workspace is read-only.", "Choose a plan to restore full access."],
      })
      report.lapsed++
      return
    }

    case "overdue": {
      if (!(await firstTime(companyId, "payment_overdue", sub.id, `Payment overdue (grace ended ${date(sub.graceEndsAt)})`))) return
      const unpaid = await prisma.billingInvoice.findFirst({ where: { companyId, status: "unpaid" }, orderBy: { issuedAt: "desc" } })
      await notifyCompany(companyId, {
        type: "billing.overdue",
        subject: "Payment overdue — your TexonPOS workspace is read-only",
        title: "Payment overdue",
        lines: [
          unpaid ? `Invoice ${unpaid.number} (${money(unpaid.amount)}) is overdue.` : "Your subscription payment is overdue.",
          "Your data is safe, but the workspace is read-only until the payment is confirmed.",
        ],
      })
      report.overdueNotices++
      return
    }

    case "retention_expired": {
      if (!(await firstTime(companyId, "retention_expired", companyId, `Retention period ended ${date(action.retentionEndsAt)} — eligible for deletion`))) return
      report.retentionExpired++
      return
    }
  }
}
