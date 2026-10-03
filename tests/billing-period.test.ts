import { describe, expect, it } from "vitest"
import { activationPeriod, addPeriod, mrrSeries, periodMonths, renewalPeriod } from "@/server/modules/platform/lifecycle"

const d = (iso: string) => new Date(iso)
const iso = (x: Date) => x.toISOString()

describe("billing period computation", () => {
  it("adds one month keeping day and time", () => {
    expect(iso(addPeriod(d("2026-03-15T09:30:00Z"), "monthly"))).toBe("2026-04-15T09:30:00.000Z")
    expect(iso(addPeriod(d("2026-12-10T00:00:00Z"), "monthly"))).toBe("2027-01-10T00:00:00.000Z")
  })

  it("adds one year", () => {
    expect(iso(addPeriod(d("2026-06-01T06:00:00Z"), "yearly"))).toBe("2027-06-01T06:00:00.000Z")
  })

  it("clamps to month end instead of overflowing into the next month", () => {
    expect(iso(addPeriod(d("2026-01-31T10:00:00Z"), "monthly"))).toBe("2026-02-28T10:00:00.000Z")
    expect(iso(addPeriod(d("2028-01-31T10:00:00Z"), "monthly"))).toBe("2028-02-29T10:00:00.000Z") // leap year
    expect(iso(addPeriod(d("2026-03-31T10:00:00Z"), "monthly"))).toBe("2026-04-30T10:00:00.000Z")
    expect(iso(addPeriod(d("2026-08-31T10:00:00Z"), "monthly"))).toBe("2026-09-30T10:00:00.000Z")
  })

  it("clamps 29 Feb to 28 Feb on yearly plans", () => {
    expect(iso(addPeriod(d("2028-02-29T00:00:00Z"), "yearly"))).toBe("2029-02-28T00:00:00.000Z")
  })

  it("keeps the billing anchor day across short months on renewal", () => {
    // started 31 Jan → first period ends 28 Feb; renewal goes back to the 31st
    const p1 = { currentPeriodStart: d("2026-01-31T10:00:00Z"), currentPeriodEnd: addPeriod(d("2026-01-31T10:00:00Z"), "monthly") }
    const p2 = renewalPeriod(p1, "monthly")
    expect(iso(p2.start)).toBe("2026-02-28T10:00:00.000Z")
    expect(iso(p2.end)).toBe("2026-03-31T10:00:00.000Z")
    const p3 = renewalPeriod({ currentPeriodStart: p2.start, currentPeriodEnd: p2.end }, "monthly")
    expect(iso(p3.end)).toBe("2026-04-30T10:00:00.000Z")
    // a period that genuinely started on the 28th stays on the 28th
    const q = renewalPeriod({ currentPeriodStart: d("2026-02-28T00:00:00Z"), currentPeriodEnd: d("2026-03-28T00:00:00Z") }, "monthly")
    expect(iso(q.end)).toBe("2026-04-28T00:00:00.000Z")
  })

  it("returns to 29 Feb on yearly renewals in the next leap year", () => {
    let p = { currentPeriodStart: d("2028-02-29T00:00:00Z") as Date | null, currentPeriodEnd: addPeriod(d("2028-02-29T00:00:00Z"), "yearly") }
    const ends: string[] = [iso(p.currentPeriodEnd)]
    for (let i = 0; i < 3; i++) {
      const n = renewalPeriod(p, "yearly")
      ends.push(iso(n.end))
      p = { currentPeriodStart: n.start, currentPeriodEnd: n.end }
    }
    expect(ends).toEqual(["2029-02-28T00:00:00.000Z", "2030-02-28T00:00:00.000Z", "2031-02-28T00:00:00.000Z", "2032-02-29T00:00:00.000Z"])
  })

  it("counts whole months in a period", () => {
    expect(periodMonths(d("2026-01-31T00:00:00Z"), d("2026-02-28T00:00:00Z"))).toBe(1)
    expect(periodMonths(d("2026-05-01T00:00:00Z"), d("2027-05-01T00:00:00Z"))).toBe(12)
  })
})

describe("activation period on payment", () => {
  const paidAt = d("2026-05-20T08:00:00Z")
  it("starts a fresh period on the payment date for a plan purchase", () => {
    const p = activationPeriod("new", { periodStart: d("2026-05-01T00:00:00Z"), periodEnd: d("2026-06-01T00:00:00Z") }, paidAt, "monthly")
    expect(iso(p.start)).toBe("2026-05-20T08:00:00.000Z")
    expect(iso(p.end)).toBe("2026-06-20T08:00:00.000Z")
    expect(iso(activationPeriod("change", { periodStart: null, periodEnd: null }, paidAt, "yearly").end)).toBe("2027-05-20T08:00:00.000Z")
  })
  it("keeps renewal continuity when paid late within the period", () => {
    const p = activationPeriod("renewal", { periodStart: d("2026-05-15T00:00:00Z"), periodEnd: d("2026-06-15T00:00:00Z") }, paidAt, "monthly")
    expect(iso(p.start)).toBe("2026-05-15T00:00:00.000Z")
    expect(iso(p.end)).toBe("2026-06-15T00:00:00.000Z")
  })
  it("restarts a renewal paid after its whole period has passed", () => {
    const p = activationPeriod("renewal", { periodStart: d("2026-03-15T00:00:00Z"), periodEnd: d("2026-04-15T00:00:00Z") }, paidAt, "monthly")
    expect(iso(p.start)).toBe(iso(paidAt))
  })
})

describe("MRR trend", () => {
  it("spreads yearly invoices over 12 months and monthly ones over their month", () => {
    const now = d("2026-06-20T00:00:00Z")
    const s = mrrSeries(
      [
        { amount: 12000, periodStart: d("2026-01-01T00:00:00Z"), periodEnd: d("2027-01-01T00:00:00Z"), paidAt: d("2026-01-01T00:00:00Z") },
        { amount: 3500, periodStart: d("2026-06-03T00:00:00Z"), periodEnd: d("2026-07-03T00:00:00Z"), paidAt: d("2026-06-03T00:00:00Z") },
      ],
      now,
      6,
    )
    expect(s.map((x) => x.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"])
    expect(s.map((x) => x.mrr)).toEqual([1000, 1000, 1000, 1000, 1000, 4500])
  })
})
