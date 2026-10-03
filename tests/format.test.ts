import { describe, expect, it } from "vitest"
import { compactMoney, money, quantity } from "@/lib/format"

describe("Bangladesh number formats", () => {
  it("uses lakh grouping", () => {
    expect(money(1234567.5)).toBe("৳\u00a012,34,567.50")
    expect(quantity(1500.125)).toBe("1,500.125")
  })
  it("compacts to lakh and crore", () => {
    expect(compactMoney(21_400_000)).toBe("৳2.14 Cr")
    expect(compactMoney(250_000)).toBe("৳2.50 L")
  })
})
