import { describe, expect, it } from "vitest"
import {
  availableCredit,
  balanceState,
  customerFormSchema,
  customerSchema,
  customerUpdateSchema,
  openingLedgerSides,
  signedOpening,
  splitOpening,
} from "@/lib/validation/customers"

describe("customer opening balance (CRM-02)", () => {
  it("converts amount + side to a signed balance", () => {
    expect(signedOpening(5000, "due")).toBe(5000)
    expect(signedOpening(5000, "advance")).toBe(-5000)
    expect(signedOpening(-300, "due")).toBe(300)
    expect(signedOpening(0, "advance")).toBe(0)
  })
  it("round-trips through splitOpening", () => {
    expect(splitOpening(-1200)).toEqual({ amount: 1200, side: "advance" })
    expect(splitOpening(800)).toEqual({ amount: 800, side: "due" })
    expect(splitOpening(0)).toEqual({ amount: 0, side: "due" })
  })
  it("posts due as debit and advance as credit", () => {
    expect(openingLedgerSides(2500)).toEqual({ debit: 2500, credit: 0 })
    expect(openingLedgerSides(-2500)).toEqual({ debit: 0, credit: 2500 })
    expect(openingLedgerSides(0)).toBeNull()
  })
})

describe("credit and balance presentation", () => {
  it("available credit never goes negative and grows with an advance", () => {
    expect(availableCredit(50000, 20000)).toBe(30000)
    expect(availableCredit(50000, 65000)).toBe(0)
    expect(availableCredit(50000, -5000)).toBe(55000)
    expect(availableCredit(0, 0)).toBe(0)
  })
  it("classifies balances", () => {
    expect(balanceState(150.5)).toEqual({ kind: "due", amount: 150.5 })
    expect(balanceState(-75)).toEqual({ kind: "advance", amount: 75 })
    expect(balanceState(0.001).kind).toBe("settled")
  })
})

describe("customer schemas", () => {
  it("accepts the POS quick-add contract with defaults", () => {
    const v = customerSchema.parse({ name: "Rahim Traders", phone: "01711000000" })
    expect(v).toMatchObject({ name: "Rahim Traders", phone: "01711000000", type: "retail", creditLimit: 0, openingBalance: 0, branchId: null, email: null })
  })
  it("allows a negative (advance) opening balance but not a negative credit limit", () => {
    expect(customerSchema.parse({ name: "Karim", openingBalance: -2000 }).openingBalance).toBe(-2000)
    expect(customerSchema.safeParse({ name: "Karim", creditLimit: -1 }).success).toBe(false)
  })
  it("update schema drops the opening balance", () => {
    const v = customerUpdateSchema.parse({ name: "Karim", openingBalance: 9999 })
    expect("openingBalance" in v).toBe(false)
  })
  it("form schema coerces string inputs and maps 'none' branch to null", () => {
    const v = customerFormSchema.parse({ name: "Karim", creditLimit: "15000", openingAmount: "500", openingSide: "advance", branchId: "none" })
    expect(v.creditLimit).toBe(15000)
    expect(signedOpening(v.openingAmount, v.openingSide)).toBe(-500)
    expect(v.branchId).toBeNull()
  })
})
