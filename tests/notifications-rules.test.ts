import { describe, expect, it } from "vitest"
import {
  canSeeType,
  creditOverdueCutoff,
  daysUntil,
  digestDue,
  dueHorizon,
  isCreditOverdue,
  isDuplicate,
  lcArrivalState,
  mergeSettings,
  pickRecipients,
  resolveSettings,
  subscriptionAlert,
  type Recipient,
} from "@/server/modules/notifications/rules"

const H = 3_600_000
const D = 24 * H
// 2026-10-04 10:00 in Dhaka (UTC+6) = 04:00 UTC
const now = new Date("2026-10-04T04:00:00Z")
const day = (s: string) => new Date(`${s}T00:00:00Z`) // how Prisma returns @db.Date

describe("de-duplication window", () => {
  const base = { userId: "u1", type: "low_stock", link: "/app/inventory/low-stock?branchId=b1" }
  it("suppresses the same type+link within 24h", () => {
    expect(isDuplicate([{ ...base, createdAt: new Date(now.getTime() - 23 * H) }], base, now)).toBe(true)
  })
  it("allows it again after 24h", () => {
    expect(isDuplicate([{ ...base, createdAt: new Date(now.getTime() - 24 * H) }], base, now)).toBe(false)
  })
  it("treats a different link, type or recipient as new", () => {
    const e = [{ ...base, createdAt: new Date(now.getTime() - H) }]
    expect(isDuplicate(e, { ...base, link: "/app/inventory/low-stock?branchId=b2" }, now)).toBe(false)
    expect(isDuplicate(e, { ...base, type: "lc_arrival" }, now)).toBe(false)
    expect(isDuplicate(e, { ...base, userId: "u2" }, now)).toBe(false)
  })
  it("matches null links", () => {
    expect(isDuplicate([{ userId: null, type: "x", link: null, createdAt: now }], { userId: null, type: "x" }, now)).toBe(true)
  })
})

describe("LC arrival selection (company timezone)", () => {
  it("counts calendar days in Asia/Dhaka", () => {
    expect(daysUntil(day("2026-10-04"), now)).toBe(0)
    // 22:00 UTC on Oct 3 is already Oct 4 in Dhaka
    expect(daysUntil(day("2026-10-04"), new Date("2026-10-03T22:00:00Z"))).toBe(0)
  })
  it("flags due within 3 days, today and overdue; ignores further dates", () => {
    expect(lcArrivalState(day("2026-10-07"), now)).toEqual({ kind: "soon", days: 3 })
    expect(lcArrivalState(day("2026-10-05"), now)).toEqual({ kind: "soon", days: 1 })
    expect(lcArrivalState(day("2026-10-04"), now)).toEqual({ kind: "today", days: 0 })
    expect(lcArrivalState(day("2026-10-01"), now)).toEqual({ kind: "overdue", days: 3 })
    expect(lcArrivalState(day("2026-10-08"), now)).toBeNull()
    expect(lcArrivalState(null, now)).toBeNull()
  })
  it("query horizon is today + 3 days", () => {
    expect(dueHorizon(now).toISOString().slice(0, 10)).toBe("2026-10-07")
  })
})

describe("overdue credit selection", () => {
  const inv = { type: "credit", status: "confirmed", dueAmount: "1500.00", invoiceDate: new Date(now.getTime() - 31 * D) }
  it("is overdue after the credit period with money still due", () => {
    expect(isCreditOverdue(inv, now, 30)).toBe(true)
    expect(isCreditOverdue({ ...inv, invoiceDate: new Date(now.getTime() - 29 * D) }, now, 30)).toBe(false)
    expect(isCreditOverdue(inv, now, 45)).toBe(false)
  })
  it("ignores paid, cash and cancelled invoices", () => {
    expect(isCreditOverdue({ ...inv, dueAmount: "0.00" }, now, 30)).toBe(false)
    expect(isCreditOverdue({ ...inv, type: "cash" }, now, 30)).toBe(false)
    expect(isCreditOverdue({ ...inv, status: "cancelled" }, now, 30)).toBe(false)
    expect(isCreditOverdue({ ...inv, status: "partially_returned" }, now, 30)).toBe(true)
  })
  it("cutoff is exactly N days back", () => {
    expect(now.getTime() - creditOverdueCutoff(now, 30).getTime()).toBe(30 * D)
  })
})

describe("subscription alerts", () => {
  const sub = { status: "trialing", trialEndsAt: new Date(now.getTime() + 2.5 * D), currentPeriodEnd: null }
  it("trial ending within 3 days", () => {
    expect(subscriptionAlert(sub, now)).toEqual({ kind: "trial_ending", days: 3 })
    expect(subscriptionAlert({ ...sub, trialEndsAt: new Date(now.getTime() + 5 * D) }, now)).toBeNull()
    expect(subscriptionAlert({ ...sub, trialEndsAt: new Date(now.getTime() - D) }, now)).toEqual({ kind: "trial_ended" })
    expect(subscriptionAlert({ ...sub, trialEndsAt: new Date(now.getTime() - 8 * D) }, now)).toBeNull()
  })
  it("renewal due and past due", () => {
    const active = { status: "active", trialEndsAt: null, currentPeriodEnd: new Date(now.getTime() + 2 * D) }
    expect(subscriptionAlert(active, now)).toEqual({ kind: "renewal_due", days: 2 })
    expect(subscriptionAlert({ ...active, currentPeriodEnd: new Date(now.getTime() + 10 * D) }, now)).toBeNull()
    expect(subscriptionAlert({ ...active, status: "past_due" }, now)).toEqual({ kind: "past_due" })
    expect(subscriptionAlert(null, now)).toBeNull()
  })
})

describe("daily digest", () => {
  it("sends once per local day after 08:00", () => {
    expect(digestDue(null, now)).toBe(true)
    expect(digestDue(null, new Date("2026-10-04T01:00:00Z"))).toBe(false) // 07:00 Dhaka
    expect(digestDue(new Date("2026-10-04T03:00:00Z"), now)).toBe(false) // already sent today
    expect(digestDue(new Date("2026-10-03T03:00:00Z"), now)).toBe(true)
  })
})

describe("settings & recipients", () => {
  it("resolves defaults and merges without dropping other keys", () => {
    expect(resolveSettings(null)).toMatchObject({ creditDueDays: 30, prefs: { lowStock: true, email: false } })
    const merged = mergeSettings({ cancelWindowHours: 24, notifications: { email: true } }, { notifications: { lowStock: false }, creditDueDays: 45 })
    expect(merged).toMatchObject({ cancelWindowHours: 24, creditDueDays: 45, notifications: { email: true, lowStock: false, lcArrival: true } })
    expect(resolveSettings({ creditDueDays: -3 }).creditDueDays).toBe(30)
  })
  it("picks users by permission and branch access", () => {
    const u = (id: string, p: Partial<Recipient>): Recipient => ({ id, name: id, email: `${id}@x.test`, isOwner: false, allBranches: false, permissions: [], branchIds: [], ...p })
    const users = [
      u("owner", { isOwner: true, allBranches: true }),
      u("store", { permissions: ["inventory.view"], branchIds: ["b1"] }),
      u("other", { permissions: ["inventory.view"], branchIds: ["b2"] }),
      u("sales", { permissions: ["sales.view"], branchIds: ["b1"] }),
    ]
    expect(pickRecipients(users, "low_stock", "b1").map((x) => x.id)).toEqual(["owner", "store"])
    expect(pickRecipients(users, "subscription").map((x) => x.id)).toEqual(["owner"])
    expect(pickRecipients(users, "credit_overdue", "b1").map((x) => x.id)).toEqual(["owner", "sales"])
    expect(canSeeType({ isOwner: false, permissions: ["settings.billing"] }, "billing.payment_failed")).toBe(true)
    expect(canSeeType({ isOwner: false, permissions: [] }, "billing.payment_failed")).toBe(false)
  })
})
