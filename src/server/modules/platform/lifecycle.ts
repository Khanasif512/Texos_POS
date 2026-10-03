// Pure subscription/billing rules — no DB, no "server-only", so they are unit-tested directly
// (tests/billing-*.test.ts) and reused by billing.ts, jobs.ts and the admin analytics.

export type Cycle = "monthly" | "yearly"
export type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired"

export const DAY_MS = 86_400_000
/** NFR-CMP-02: data kept read-only/export-only this long after cancellation. */
export const RETENTION_DAYS = 90
/** Trial-ending reminder is sent once when the trial has this many days or fewer left. */
export const TRIAL_REMINDER_DAYS = 3

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

/**
 * One billing period after `start`, clamped to month end (31 Jan + 1 month = 28/29 Feb).
 * `anchorDay` keeps the original billing day across short months: a subscription that started on
 * the 31st renews 31 Jan → 28 Feb → 31 Mar instead of drifting to the 28th forever.
 * Computed in UTC so the result does not depend on the server's timezone.
 */
export function addPeriod(start: Date, cycle: Cycle, anchorDay?: number) {
  const months = cycle === "yearly" ? 12 : 1
  const y = start.getUTCFullYear()
  const m = start.getUTCMonth() + months
  const ty = y + Math.floor(m / 12)
  const tm = m % 12
  const day = Math.min(anchorDay ?? start.getUTCDate(), daysInMonth(ty, tm))
  return new Date(
    Date.UTC(ty, tm, day, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()),
  )
}

/**
 * The period that follows the current one (renewal), keeping the billing anchor day. The anchor is the
 * later of the current period's start/end day: an end clamped to 28 Feb still carries the 31st from its start,
 * and a period that started on a clamped 28 Feb carries the 31st on its end. A period running from one month
 * end to another stays on month end (yearly 29 Feb → 28 Feb → 28 Feb → 29 Feb).
 */
export function renewalPeriod(sub: { currentPeriodStart: Date | null; currentPeriodEnd: Date }, cycle: Cycle) {
  const start = sub.currentPeriodEnd
  const prev = sub.currentPeriodStart
  const isMonthEnd = (x: Date) => x.getUTCDate() === daysInMonth(x.getUTCFullYear(), x.getUTCMonth())
  const anchor = prev && isMonthEnd(prev) && isMonthEnd(start) ? 31 : Math.max(start.getUTCDate(), prev?.getUTCDate() ?? 0)
  return { start, end: addPeriod(start, cycle, anchor) }
}

export type InvoiceKind = "new" | "change" | "renewal" | "manual"

/**
 * Period a subscription gets when an invoice is paid. Renewals keep continuity with the previous
 * period (paying late does not shift the billing day) unless that period is already over; plan
 * purchases / changes start a fresh period on the payment date.
 */
export function activationPeriod(
  kind: InvoiceKind,
  invoice: { periodStart: Date | null; periodEnd: Date | null },
  paidAt: Date,
  cycle: Cycle,
) {
  if (kind === "renewal" && invoice.periodStart && invoice.periodEnd && invoice.periodEnd > paidAt)
    return { start: invoice.periodStart, end: invoice.periodEnd }
  return { start: paidAt, end: addPeriod(paidAt, cycle) }
}

export const priceFor = <T>(plan: { priceMonthly: T; priceYearly: T }, cycle: Cycle) =>
  cycle === "yearly" ? plan.priceYearly : plan.priceMonthly

// ───────────────────────────── Plan changes ─────────────────────────────

export type Usage = { branches: number; employees: number; products: number }
export type Limits = { maxBranches: number; maxEmployees: number; maxProducts: number | null }
export type Blocker = { resource: keyof Usage; used: number; limit: number; message: string }

/** Why a company cannot move to a plan: current usage above the plan's limits (null limit = unlimited). */
export function downgradeBlockers(usage: Usage, limits: Limits): Blocker[] {
  const out: Blocker[] = []
  const check = (resource: keyof Usage, limit: number | null, noun: string, verb: string) => {
    const used = usage[resource]
    if (limit != null && used > limit)
      out.push({
        resource,
        used,
        limit,
        message: `You have ${used} active ${noun} but this plan allows ${limit}. ${verb} ${used - limit} first.`,
      })
  }
  check("branches", limits.maxBranches, "branches", "Deactivate")
  check("employees", limits.maxEmployees, "team members", "Deactivate")
  check("products", limits.maxProducts, "products", "Archive")
  return out
}

export type ChangeKind = "current" | "upgrade" | "downgrade" | "choose"

/** How a plan card is labelled relative to the company's current subscription. */
export function planChangeKind(
  current: { planId: string; cycle: Cycle; priceMonthly: number | string; paid: boolean } | null,
  target: { id: string; priceMonthly: number | string },
  cycle: Cycle,
): ChangeKind {
  if (!current || !current.paid) return "choose"
  if (current.planId === target.id) return current.cycle === cycle ? "current" : cycle === "yearly" ? "upgrade" : "downgrade"
  return Number(target.priceMonthly) > Number(current.priceMonthly) ? "upgrade" : "downgrade"
}

// ───────────────────────────── Lifecycle job ─────────────────────────────

export type SubState = {
  status: SubStatus
  billingCycle: Cycle
  trialEndsAt: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  graceEndsAt: Date | null
  autoRenew: boolean
  cancelledAt: Date | null
}

export type JobAction =
  | { type: "trial_reminder"; daysLeft: number }
  | { type: "expire_trial" }
  | { type: "renew"; periodStart: Date; periodEnd: Date; graceEndsAt: Date }
  | { type: "end_cancelled" }
  | { type: "lapse" }
  | { type: "overdue" }
  | { type: "retention_expired"; retentionEndsAt: Date }

/** When a cancelled subscription's read-only retention window closes (NFR-CMP-02). */
export function retentionEndsAt(sub: Pick<SubState, "cancelledAt" | "currentPeriodEnd">) {
  if (!sub.cancelledAt) return null
  const base = sub.currentPeriodEnd && sub.currentPeriodEnd > sub.cancelledAt ? sub.currentPeriodEnd : sub.cancelledAt
  return new Date(base.getTime() + RETENTION_DAYS * DAY_MS)
}

/**
 * TEN-02 / TEN-05 / §7: the single next step for a subscription at `now`. The job applies it with a
 * state-guarded update, so running hourly (or twice concurrently) never double-applies a transition;
 * notices (reminder / overdue / retention) are de-duplicated by the caller.
 */
export function decideSubscriptionAction(sub: SubState, now: Date, opts: { graceDays: number }): JobAction | null {
  switch (sub.status) {
    case "trialing": {
      if (!sub.trialEndsAt) return null
      if (sub.trialEndsAt <= now) return { type: "expire_trial" }
      const daysLeft = Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / DAY_MS)
      return daysLeft <= TRIAL_REMINDER_DAYS ? { type: "trial_reminder", daysLeft } : null
    }
    case "active": {
      if (!sub.currentPeriodEnd || sub.currentPeriodEnd > now) return null
      if (sub.cancelledAt) return { type: "end_cancelled" }
      if (!sub.autoRenew) return { type: "lapse" }
      const { start, end } = renewalPeriod({ currentPeriodStart: sub.currentPeriodStart, currentPeriodEnd: sub.currentPeriodEnd }, sub.billingCycle)
      return { type: "renew", periodStart: start, periodEnd: end, graceEndsAt: new Date(now.getTime() + opts.graceDays * DAY_MS) }
    }
    case "past_due":
      return sub.graceEndsAt && sub.graceEndsAt <= now ? { type: "overdue" } : null
    case "cancelled": {
      const ends = retentionEndsAt(sub)
      return ends && ends <= now ? { type: "retention_expired", retentionEndsAt: ends } : null
    }
    default:
      return null
  }
}

// ───────────────────────────── Analytics ─────────────────────────────

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`

/** Whole months covered by an invoice period (1 for monthly, 12 for yearly; at least 1). */
export function periodMonths(start: Date, end: Date) {
  const m = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  return Math.max(1, m)
}

/**
 * MRR per month for the last `months` months (oldest first), from paid invoices: each invoice
 * contributes amount ÷ months-in-period to every month whose 15th falls inside its period.
 */
export function mrrSeries(
  invoices: { amount: number; periodStart: Date | null; periodEnd: Date | null; paidAt: Date | null }[],
  now: Date,
  months = 12,
) {
  const out: { month: string; mrr: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const mid = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 15))
    let mrr = 0
    for (const inv of invoices) {
      const start = inv.periodStart ?? inv.paidAt
      if (!start) continue
      const end = inv.periodEnd ?? addPeriod(start, "monthly")
      if (start <= mid && end > mid) mrr += inv.amount / periodMonths(start, end)
    }
    out.push({ month: monthKey(first), mrr: Math.round(mrr * 100) / 100 })
  }
  return out
}
