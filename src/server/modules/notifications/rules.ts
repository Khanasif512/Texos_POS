/**
 * Pure notification rules (AUD-02) — no DB, no "server-only", so they are unit-testable
 * (tests/notifications-rules.test.ts). Dates for LC arrivals are calendar dates in the company timezone.
 */

export const NOTIFICATION_TYPES = ["low_stock", "lc_arrival", "credit_overdue", "subscription"] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** Company.settings.notifications */
export type NotificationPrefs = {
  lowStock: boolean
  lcArrival: boolean
  overdueCredit: boolean
  subscription: boolean
  email: boolean
}

export const DEFAULT_PREFS: NotificationPrefs = {
  lowStock: true,
  lcArrival: true,
  overdueCredit: true,
  subscription: true,
  email: false,
}

export const DEFAULT_CREDIT_DUE_DAYS = 30
export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000
/** Look-ahead for LC arrivals and subscription dates. */
export const DUE_SOON_DAYS = 3
/** Local hour after which the daily digest goes out. */
export const DIGEST_HOUR = 8

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** Reads prefs + credit period from the free-form Company.settings JSON with safe defaults. */
export function resolveSettings(settings: unknown): { prefs: NotificationPrefs; creditDueDays: number; digestAt: Date | null } {
  const s = isObj(settings) ? settings : {}
  const n = isObj(s.notifications) ? s.notifications : {}
  const prefs = { ...DEFAULT_PREFS }
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]) if (typeof n[k] === "boolean") prefs[k] = n[k] as boolean
  const days = Number(s.creditDueDays)
  const creditDueDays = Number.isInteger(days) && days > 0 && days <= 365 ? days : DEFAULT_CREDIT_DUE_DAYS
  const at = typeof s.notificationDigestAt === "string" ? new Date(s.notificationDigestAt) : null
  return { prefs, creditDueDays, digestAt: at && !Number.isNaN(at.getTime()) ? at : null }
}

/** Shallow-merges a patch into Company.settings without touching keys owned by other modules. */
export function mergeSettings(settings: unknown, patch: { notifications?: Partial<NotificationPrefs>; creditDueDays?: number; notificationDigestAt?: string }) {
  const s = isObj(settings) ? { ...settings } : {}
  if (patch.notifications) s.notifications = { ...DEFAULT_PREFS, ...(isObj(s.notifications) ? s.notifications : {}), ...patch.notifications }
  if (patch.creditDueDays !== undefined) s.creditDueDays = patch.creditDueDays
  if (patch.notificationDigestAt !== undefined) s.notificationDigestAt = patch.notificationDigestAt
  return s
}

// ───────────────────────── de-duplication ─────────────────────────

export const dedupKey = (userId: string | null, type: string, link: string | null | undefined) => `${userId ?? "*"}|${type}|${link ?? ""}`

/** True when the same type+link was already sent to this recipient within the 24h window. */
export function isDuplicate(
  existing: { userId: string | null; type: string; link: string | null; createdAt: Date }[],
  candidate: { userId: string | null; type: string; link?: string | null },
  now: Date,
  windowMs = DEDUP_WINDOW_MS,
) {
  const key = dedupKey(candidate.userId, candidate.type, candidate.link)
  return existing.some((e) => dedupKey(e.userId, e.type, e.link) === key && now.getTime() - e.createdAt.getTime() < windowMs)
}

// ───────────────────────── calendar helpers ─────────────────────────

/** yyyy-mm-dd of `d` in the given IANA timezone. */
export function localDateKey(d: Date, timeZone = "Asia/Dhaka") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
}

/** Hour (0–23) of `d` in the given timezone. */
export function localHour(d: Date, timeZone = "Asia/Dhaka") {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(d))
}

const dayIndex = (key: string) => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86_400_000)

/**
 * Calendar days from "today" (company timezone) to a DATE column value.
 * Prisma returns @db.Date as UTC midnight, so the target's UTC date is its calendar date.
 */
export function daysUntil(target: Date, now: Date, timeZone = "Asia/Dhaka") {
  return dayIndex(target.toISOString().slice(0, 10)) - dayIndex(localDateKey(now, timeZone))
}

/** Latest DATE value that is "due within the window" — for the DB query (`expectedArrivalDate <= this`). */
export function dueHorizon(now: Date, timeZone = "Asia/Dhaka", days = DUE_SOON_DAYS) {
  const today = localDateKey(now, timeZone)
  return new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + days))
}

// ───────────────────────── due-date selection ─────────────────────────

export type ArrivalState = { kind: "overdue" | "today" | "soon"; days: number }

/** LC arrival: due within 3 days (inclusive), today, or overdue; null when further out or no date. */
export function lcArrivalState(expected: Date | null | undefined, now: Date, timeZone = "Asia/Dhaka", windowDays = DUE_SOON_DAYS): ArrivalState | null {
  if (!expected) return null
  const d = daysUntil(expected, now, timeZone)
  if (d < 0) return { kind: "overdue", days: -d }
  if (d === 0) return { kind: "today", days: 0 }
  if (d <= windowDays) return { kind: "soon", days: d }
  return null
}

/** Invoices dated before this instant are overdue. */
export const creditOverdueCutoff = (now: Date, creditDueDays: number) => new Date(now.getTime() - creditDueDays * 86_400_000)

export function isCreditOverdue(
  inv: { type: string; status: string; dueAmount: number | string | { toString(): string }; invoiceDate: Date },
  now: Date,
  creditDueDays: number,
) {
  return (
    inv.type === "credit" &&
    (inv.status === "confirmed" || inv.status === "partially_returned") &&
    Number(inv.dueAmount.toString()) > 0 &&
    inv.invoiceDate < creditOverdueCutoff(now, creditDueDays)
  )
}

export type SubscriptionAlert =
  | { kind: "trial_ending"; days: number }
  | { kind: "trial_ended" }
  | { kind: "renewal_due"; days: number }
  | { kind: "past_due" }

/** Subscription renewal due / trial ending (≤ 3 days) / payment overdue. */
export function subscriptionAlert(
  sub: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null; autoRenew?: boolean } | null,
  now: Date,
  windowDays = DUE_SOON_DAYS,
): SubscriptionAlert | null {
  if (!sub) return null
  const daysTo = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / 86_400_000)
  if (sub.status === "trialing" && sub.trialEndsAt) {
    // Remind daily for a week after the trial ended, then stop (the read-only banner takes over).
    if (sub.trialEndsAt <= now) return now.getTime() - sub.trialEndsAt.getTime() <= 7 * 86_400_000 ? { kind: "trial_ended" } : null
    const d = daysTo(sub.trialEndsAt)
    return d <= windowDays ? { kind: "trial_ending", days: d } : null
  }
  if (sub.status === "past_due") return { kind: "past_due" }
  if (sub.status === "active" && sub.currentPeriodEnd) {
    const d = daysTo(sub.currentPeriodEnd)
    return d >= 0 && d <= windowDays ? { kind: "renewal_due", days: d } : null
  }
  return null
}

/** Daily digest: once per local calendar day, after DIGEST_HOUR. */
export function digestDue(last: Date | null, now: Date, timeZone = "Asia/Dhaka", hour = DIGEST_HOUR) {
  if (localHour(now, timeZone) < hour) return false
  return !last || localDateKey(last, timeZone) !== localDateKey(now, timeZone)
}

// ───────────────────────── recipients ─────────────────────────

export type Recipient = {
  id: string
  name: string
  email: string
  isOwner: boolean
  allBranches: boolean
  permissions: string[]
  branchIds: string[]
}

/** Who may see a notification type (null = owners only). Unknown types are visible to everyone. */
export const TYPE_PERMISSIONS: Record<NotificationType, string[] | null> = {
  low_stock: ["inventory.view"],
  lc_arrival: ["lc.view"],
  credit_overdue: ["sales.view", "customers.view"],
  subscription: null,
}

/** Platform billing notices (src/server/modules/platform) use `billing.*` types. */
export const BILLING_PREFIX = "billing."
export const BILLING_PERMISSION = "settings.billing"

export function canSeeType(user: { isOwner: boolean; permissions: string[] | Set<string> }, type: string) {
  if (user.isOwner) return true
  const has = (p: string) => (user.permissions instanceof Set ? user.permissions.has(p) : user.permissions.includes(p))
  if (type.startsWith(BILLING_PREFIX)) return has(BILLING_PERMISSION)
  if (!(type in TYPE_PERMISSIONS)) return true
  const perms = TYPE_PERMISSIONS[type as NotificationType]
  if (!perms) return false
  return perms.some(has)
}

/** Eligible users for a type, optionally limited to those who can access a branch (AUTH-03). */
export function pickRecipients(users: Recipient[], type: string, branchId?: string | null) {
  return users.filter(
    (u) => canSeeType(u, type) && (!branchId || u.isOwner || u.allBranches || u.branchIds.includes(branchId)),
  )
}

/** Types hidden from a user when reading broadcast (userId = null) rows. */
export function hiddenTypesFor(user: { isOwner: boolean; permissions: string[] | Set<string> }) {
  return NOTIFICATION_TYPES.filter((t) => !canSeeType(user, t))
}
