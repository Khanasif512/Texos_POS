import { describe, expect, it } from "vitest"
import {
  amountInWords,
  cancelWindow,
  cancelWindowHours,
  checkCreditLimit,
  computeTotals,
  integerToWords,
  lineCost,
  lineProfit,
  SalesCalcError,
  weightedCost,
} from "@/server/modules/sales/calc"
import { printStatusLabel } from "@/lib/validation/sales"

const s = (v: { toFixed(dp: number): string }) => v.toFixed(2)

describe("invoice totals (SLS-01)", () => {
  it("computes line totals, subtotal and total with discount, tax and delivery", () => {
    const t = computeTotals({
      lines: [
        { quantity: 3, unitPrice: "1250.50", discount: "51.50" },
        { quantity: "2.5", unitPrice: 99.99, discount: 0 },
      ],
      discount: 100,
      tax: "37.25",
      deliveryCharge: 300,
    })
    expect(s(t.lines[0].lineTotal)).toBe("3700.00") // 3751.50 − 51.50
    expect(s(t.lines[1].lineTotal)).toBe("249.98") // 249.975 → 249.98 (half-up)
    expect(s(t.subtotal)).toBe("3949.98")
    expect(s(t.total)).toBe("4187.23") // 3949.98 − 100 + 37.25 + 300
    expect(s(t.totalDiscount)).toBe("151.50")
  })

  it("avoids float drift", () => {
    const t = computeTotals({ lines: [{ quantity: 3, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }] })
    expect(s(t.subtotal)).toBe("0.50")
    expect(t.total.toString()).toBe("0.5")
  })

  it("defaults optional amounts to zero", () => {
    const t = computeTotals({ lines: [{ quantity: 1, unitPrice: 500 }] })
    expect(s(t.total)).toBe("500.00")
    expect(s(t.discount)).toBe("0.00")
  })

  it("rejects bad input", () => {
    expect(() => computeTotals({ lines: [{ quantity: 0, unitPrice: 10 }] })).toThrow(SalesCalcError)
    expect(() => computeTotals({ lines: [{ quantity: 1, unitPrice: 10, discount: 11 }] })).toThrow(/Line discount/)
    expect(() => computeTotals({ lines: [{ quantity: 1, unitPrice: 10 }], discount: 10.01 })).toThrow(/exceed the subtotal/)
    try {
      computeTotals({ lines: [{ quantity: 1, unitPrice: 10 }, { quantity: -1, unitPrice: 1 }] })
    } catch (e) {
      expect((e as SalesCalcError).field).toBe("lines.1.quantity")
    }
  })

  it("allows a 100% discount", () => {
    expect(s(computeTotals({ lines: [{ quantity: 2, unitPrice: 50 }], discount: 100 }).total)).toBe("0.00")
  })
})

describe("costing and profit (SLS-02, SLS-10)", () => {
  it("weights FIFO allocations to 4 dp", () => {
    const { unitCost } = weightedCost([
      { quantity: 2, unitCost: "100.1234" },
      { quantity: 1, unitCost: "110" },
    ])
    expect(unitCost.toFixed(4)).toBe("103.4156")
    expect(lineCost(3, unitCost).toFixed(2)).toBe("310.25")
  })

  it("profit = (price − cost) × qty − line discount", () => {
    expect(lineProfit({ quantity: 4, unitPrice: 250, unitCost: "180.5", discount: 20 }).toFixed(2)).toBe("258.00")
    expect(lineProfit({ quantity: 1, unitPrice: 100, unitCost: 120 }).toFixed(2)).toBe("-20.00")
  })
})

describe("credit limit (CRM-01)", () => {
  it("allows a sale within the limit", () => {
    const r = checkCreditLimit({ balance: 20000, creditLimit: 50000, newDue: 30000 })
    expect(r.blocked).toBe(false)
    expect(r.available.toFixed(2)).toBe("30000.00")
  })

  it("blocks when balance + new due exceeds the limit", () => {
    const r = checkCreditLimit({ balance: 20000, creditLimit: 50000, newDue: "30000.01" })
    expect(r.blocked).toBe(true)
    expect(r.excess.toFixed(2)).toBe("0.01")
  })

  it("treats a zero limit as no credit", () => {
    expect(checkCreditLimit({ balance: 0, creditLimit: 0, newDue: 1 }).blocked).toBe(true)
    expect(checkCreditLimit({ balance: 0, creditLimit: 0, newDue: 0 }).blocked).toBe(false)
  })

  it("counts an advance (negative balance) toward available credit", () => {
    const r = checkCreditLimit({ balance: -5000, creditLimit: 0, newDue: 5000 })
    expect(r.blocked).toBe(false)
  })

  it("does not block a fully paid credit invoice for a customer already over limit", () => {
    expect(checkCreditLimit({ balance: 90000, creditLimit: 50000, newDue: 0 }).blocked).toBe(false)
    expect(checkCreditLimit({ balance: 90000, creditLimit: 50000, newDue: 0 }).available.toFixed(2)).toBe("0.00")
  })
})

describe("cancel window (SLS-05)", () => {
  const created = new Date("2026-10-01T10:00:00Z")
  it("is open inside the window and closed after it", () => {
    expect(cancelWindow({ createdAt: created, now: new Date("2026-10-02T09:59:00Z"), windowHours: 24 }).open).toBe(true)
    expect(cancelWindow({ createdAt: created, now: new Date("2026-10-02T10:01:00Z"), windowHours: 24 }).open).toBe(false)
  })
  it("lets the owner cancel any time", () => {
    const w = cancelWindow({ createdAt: created, now: new Date("2026-12-01T00:00:00Z"), windowHours: 24, isOwner: true })
    expect(w.open).toBe(true)
    expect(w.bypass).toBe(true)
  })
  it("supports a zero-hour window and defaults to 24h", () => {
    expect(cancelWindow({ createdAt: created, now: new Date("2026-10-01T10:00:01Z"), windowHours: 0 }).open).toBe(false)
    expect(cancelWindow({ createdAt: created, now: new Date("2026-10-01T20:00:00Z") }).hours).toBe(24)
  })
  it("reads the setting from company settings JSON", () => {
    expect(cancelWindowHours({ cancelWindowHours: 48 })).toBe(48)
    expect(cancelWindowHours({ cancelWindowHours: "12" })).toBe(12)
    expect(cancelWindowHours({ cancelWindowHours: -3 })).toBe(24)
    expect(cancelWindowHours(null)).toBe(24)
  })
})

describe("amount in words", () => {
  it("uses the crore / lakh system", () => {
    expect(integerToWords(0)).toBe("Zero")
    expect(integerToWords(15)).toBe("Fifteen")
    expect(integerToWords(101)).toBe("One Hundred One")
    expect(integerToWords(1250)).toBe("One Thousand Two Hundred Fifty")
    expect(integerToWords(123456)).toBe("One Lakh Twenty-Three Thousand Four Hundred Fifty-Six")
    expect(integerToWords(12345678)).toBe("One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight")
    expect(integerToWords(1000000000)).toBe("One Hundred Crore")
  })
  it("formats taka and paisa", () => {
    expect(amountInWords(4187.23)).toBe("Taka Four Thousand One Hundred Eighty-Seven and Paisa Twenty-Three Only")
    expect(amountInWords("500")).toBe("Taka Five Hundred Only")
    expect(amountInWords(0)).toBe("Taka Zero Only")
    expect(amountInWords("0.999")).toBe("Taka One Only")
  })
})

describe("print status (SLS-08)", () => {
  it("labels print counts", () => {
    expect(printStatusLabel(0)).toBe("Not printed")
    expect(printStatusLabel(1)).toBe("Printed")
    expect(printStatusLabel(3)).toBe("Reprinted ×2")
  })
})
