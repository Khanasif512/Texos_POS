import { describe, expect, it } from "vitest"
import { ALL_PERMISSION_KEYS, SYSTEM_ROLES } from "@/lib/permissions"
import { DEFAULT_PLANS } from "@/lib/plans"
import { slugify } from "@/server/modules/tenants/provision"

describe("permission catalog", () => {
  it("has unique keys", () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(ALL_PERMISSION_KEYS.length)
  })

  it("only grants known permissions to system roles", () => {
    for (const role of SYSTEM_ROLES) for (const p of role.permissions) expect(ALL_PERMISSION_KEYS).toContain(p)
  })

  it("follows the SRS §9 matrix for sensitive areas", () => {
    const role = (k: string) => SYSTEM_ROLES.find((r) => r.key === k)!.permissions
    expect(role("owner")).toEqual(ALL_PERMISSION_KEYS)
    expect(role("sales_staff").some((p) => p.startsWith("lc."))).toBe(false)
    expect(role("sales_staff")).not.toContain("inventory.view_cost")
    expect(role("inventory_manager").some((p) => p.startsWith("sales."))).toBe(false)
    expect(role("accountant")).toContain("lc.finalize")
    expect(role("accountant").some((p) => p.startsWith("org."))).toBe(false)
    expect(role("branch_manager").some((p) => p.startsWith("org."))).toBe(false)
  })
})

describe("plans", () => {
  it("exactly one default trial plan", () => {
    expect(DEFAULT_PLANS.filter((p) => p.isDefaultTrial)).toHaveLength(1)
  })
})

describe("slugify", () => {
  it("makes URL-safe workspace ids", () => {
    expect(slugify("GK Interior & Co.")).toBe("gk-interior-co")
    expect(slugify("  ")).toBe("company")
  })
})
