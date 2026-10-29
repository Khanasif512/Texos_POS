import { describe, expect, it } from "vitest"
import { companySchema } from "@/lib/validation/org"

describe("company settings schema", () => {
  const company = { name: "Example Company", email: "hello@example.com" }

  it("accepts a company logo path and normalizes a blank logo to null", () => {
    const logoUrl = "/uploads/companies/tenant/logo.webp"
    expect(companySchema.parse({ ...company, logoUrl }).logoUrl).toBe(logoUrl)
    expect(companySchema.parse({ ...company, logoUrl: "" }).logoUrl).toBeNull()
  })

  it("ignores legacy favicon settings", () => {
    expect(companySchema.parse({ ...company, faviconUrl: "/favicon.png" })).not.toHaveProperty("faviconUrl")
  })

  it("rejects a logo URL longer than the database column", () => {
    expect(companySchema.safeParse({ ...company, logoUrl: "x".repeat(501) }).success).toBe(false)
  })
})
