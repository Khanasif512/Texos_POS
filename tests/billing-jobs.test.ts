import { describe, expect, it } from "vitest"
import { decideSubscriptionAction, retentionEndsAt, type SubState } from "@/server/modules/platform/lifecycle"

const d = (iso: string) => new Date(iso)
const now = d("2026-10-03T06:00:00Z")
const opts = { graceDays: 7 }

const sub = (patch: Partial<SubState>): SubState => ({
  status: "active",
  billingCycle: "monthly",
  trialEndsAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  graceEndsAt: null,
  autoRenew: true,
  cancelledAt: null,
  ...patch,
})

describe("trial transitions (TEN-02)", () => {
  it("does nothing while more than 3 days remain", () => {
    expect(decideSubscriptionAction(sub({ status: "trialing", trialEndsAt: d("2026-10-17T06:00:00Z") }), now, opts)).toBeNull()
  })
  it("sends a reminder inside the last 3 days", () => {
    expect(decideSubscriptionAction(sub({ status: "trialing", trialEndsAt: d("2026-10-06T05:00:00Z") }), now, opts)).toEqual({ type: "trial_reminder", daysLeft: 3 })
    expect(decideSubscriptionAction(sub({ status: "trialing", trialEndsAt: d("2026-10-03T18:00:00Z") }), now, opts)).toEqual({ type: "trial_reminder", daysLeft: 1 })
  })
  it("expires a trial once trialEndsAt has passed", () => {
    expect(decideSubscriptionAction(sub({ status: "trialing", trialEndsAt: d("2026-10-03T05:59:59Z") }), now, opts)).toEqual({ type: "expire_trial" })
  })
})

describe("active subscriptions", () => {
  const period = { currentPeriodStart: d("2026-08-31T04:00:00Z"), currentPeriodEnd: d("2026-09-30T04:00:00Z") }
  it("leaves a subscription alone inside its period", () => {
    expect(decideSubscriptionAction(sub({ currentPeriodStart: d("2026-09-15T00:00:00Z"), currentPeriodEnd: d("2026-10-15T00:00:00Z") }), now, opts)).toBeNull()
  })
  it("invoices the next period and starts the grace period when auto-renew is on", () => {
    const a = decideSubscriptionAction(sub(period), now, opts)
    expect(a).toEqual({
      type: "renew",
      periodStart: d("2026-09-30T04:00:00Z"),
      periodEnd: d("2026-10-31T04:00:00Z"), // anchor day 31 restored after September
      graceEndsAt: d("2026-10-10T06:00:00Z"),
    })
  })
  it("renews yearly plans for a year", () => {
    const a = decideSubscriptionAction(sub({ billingCycle: "yearly", currentPeriodStart: d("2025-10-01T00:00:00Z"), currentPeriodEnd: d("2026-10-01T00:00:00Z") }), now, opts)
    expect(a?.type === "renew" && a.periodEnd.toISOString()).toBe("2027-10-01T00:00:00.000Z")
  })
  it("lets a subscription with auto-renew off expire", () => {
    expect(decideSubscriptionAction(sub({ ...period, autoRenew: false }), now, opts)).toEqual({ type: "lapse" })
  })
  it("ends a scheduled cancellation at period end", () => {
    expect(decideSubscriptionAction(sub({ ...period, autoRenew: false, cancelledAt: d("2026-09-10T00:00:00Z") }), now, opts)).toEqual({ type: "end_cancelled" })
  })
})

describe("lapsed payments (TEN-05)", () => {
  it("waits during the grace period", () => {
    expect(decideSubscriptionAction(sub({ status: "past_due", graceEndsAt: d("2026-10-05T00:00:00Z") }), now, opts)).toBeNull()
  })
  it("flags overdue once grace has ended (the context makes it read-only)", () => {
    expect(decideSubscriptionAction(sub({ status: "past_due", graceEndsAt: d("2026-10-01T00:00:00Z") }), now, opts)).toEqual({ type: "overdue" })
  })
  it("never touches expired subscriptions", () => {
    expect(decideSubscriptionAction(sub({ status: "expired", currentPeriodEnd: d("2026-01-01T00:00:00Z") }), now, opts)).toBeNull()
  })
})

describe("cancellation retention (NFR-CMP-02)", () => {
  it("counts 90 days from the cancellation, or from the paid period end when later", () => {
    expect(retentionEndsAt({ cancelledAt: d("2026-07-01T00:00:00Z"), currentPeriodEnd: null })?.toISOString()).toBe("2026-09-29T00:00:00.000Z")
    expect(retentionEndsAt({ cancelledAt: d("2026-07-01T00:00:00Z"), currentPeriodEnd: d("2026-07-20T00:00:00Z") })?.toISOString()).toBe("2026-10-18T00:00:00.000Z")
    expect(retentionEndsAt({ cancelledAt: null, currentPeriodEnd: null })).toBeNull()
  })
  it("flags the company once retention is over, and not before", () => {
    expect(decideSubscriptionAction(sub({ status: "cancelled", cancelledAt: d("2026-07-01T00:00:00Z") }), now, opts)).toEqual({
      type: "retention_expired",
      retentionEndsAt: d("2026-09-29T00:00:00Z"),
    })
    expect(decideSubscriptionAction(sub({ status: "cancelled", cancelledAt: d("2026-07-10T00:00:00Z") }), now, opts)).toBeNull()
  })
})
