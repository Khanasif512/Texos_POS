import { describe, expect, it } from "vitest"
import { downgradeBlockers, planChangeKind } from "@/server/modules/platform/lifecycle"
import { planSchema } from "@/lib/validation/billing"

const starter = { maxBranches: 1, maxEmployees: 5, maxProducts: 2000 }
const enterprise = { maxBranches: 25, maxEmployees: 200, maxProducts: null }

describe("downgrade eligibility", () => {
  it("allows a plan whose limits cover current usage (limits are inclusive)", () => {
    expect(downgradeBlockers({ branches: 1, employees: 5, products: 2000 }, starter)).toEqual([])
  })

  it("explains every limit that is exceeded", () => {
    const b = downgradeBlockers({ branches: 3, employees: 8, products: 2500 }, starter)
    expect(b.map((x) => [x.resource, x.used, x.limit])).toEqual([
      ["branches", 3, 1],
      ["employees", 8, 5],
      ["products", 2500, 2000],
    ])
    expect(b[0].message).toBe("You have 3 active branches but this plan allows 1. Deactivate 2 first.")
    expect(b[2].message).toContain("Archive 500 first")
  })

  it("treats a null product limit as unlimited", () => {
    expect(downgradeBlockers({ branches: 4, employees: 30, products: 1_000_000 }, enterprise)).toEqual([])
  })
})

describe("plan change labelling", () => {
  const current = { planId: "growth", cycle: "monthly" as const, priceMonthly: "3500.00", paid: true }
  it("labels upgrades, downgrades and the current plan", () => {
    expect(planChangeKind(current, { id: "enterprise", priceMonthly: 8000 }, "monthly")).toBe("upgrade")
    expect(planChangeKind(current, { id: "starter", priceMonthly: 1500 }, "monthly")).toBe("downgrade")
    expect(planChangeKind(current, { id: "growth", priceMonthly: 3500 }, "monthly")).toBe("current")
    expect(planChangeKind(current, { id: "growth", priceMonthly: 3500 }, "yearly")).toBe("upgrade")
  })
  it("offers a plain choice while trialing or unpaid", () => {
    expect(planChangeKind({ ...current, paid: false }, { id: "starter", priceMonthly: 1500 }, "monthly")).toBe("choose")
    expect(planChangeKind(null, { id: "starter", priceMonthly: 1500 }, "monthly")).toBe("choose")
  })
})

describe("plan form validation", () => {
  const base = {
    code: "Pro-Plus",
    name: "Pro Plus",
    tagline: "",
    priceMonthly: "5000",
    priceYearly: "50000",
    maxBranches: "5",
    maxEmployees: "40",
    maxProducts: "",
    features: { lc: true, crm: true },
    isPublic: true,
    isDefaultTrial: false,
    sortOrder: "4",
    status: "active",
  }
  it("normalises code, unlimited products and fills every feature flag", () => {
    const p = planSchema.parse(base)
    expect(p.code).toBe("pro-plus")
    expect(p.maxProducts).toBeNull()
    expect(p.tagline).toBeNull()
    expect(p.features).toEqual({ lc: true, purchase: false, crm: true, advancedReports: false, multiBranchTransfer: false, export: false, prioritySupport: false })
  })
  it("rejects zero branches and negative prices", () => {
    expect(planSchema.safeParse({ ...base, maxBranches: "0" }).success).toBe(false)
    expect(planSchema.safeParse({ ...base, priceMonthly: "-1" }).success).toBe(false)
  })
})
