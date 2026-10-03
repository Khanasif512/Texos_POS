import { describe, expect, it } from "vitest"
import {
  allocateOldestFirst,
  allowedRefundModes,
  amountInWords,
  applyAdvances,
  chargeFactor,
  orderTotals,
  restockableBatches,
  returnLineAmount,
  returnableQty,
  splitCreditNote,
  statusAfterReturn,
} from "@/server/modules/sales-after/calc"

const s = (v: { toFixed(n: number): string }) => v.toFixed(2)

describe("money receipt allocation (SLS-04)", () => {
  const invoices = [
    { id: "c", dueAmount: "500.00", date: "2026-09-20" },
    { id: "a", dueAmount: "1000.00", date: "2026-09-01" },
    { id: "b", dueAmount: "250.50", date: "2026-09-10" },
  ]

  it("pays the oldest invoice first", () => {
    const r = allocateOldestFirst("1100", invoices)
    expect(r.allocations.map((a) => [a.invoiceId, s(a.amount)])).toEqual([
      ["a", "1000.00"],
      ["b", "100.00"],
    ])
    expect(s(r.advance)).toBe("0.00")
  })

  it("keeps the unallocated remainder as an advance", () => {
    const r = allocateOldestFirst("2000", invoices)
    expect(r.allocations).toHaveLength(3)
    expect(s(r.advance)).toBe("249.50")
  })

  it("is all advance when nothing is due", () => {
    const r = allocateOldestFirst("300", [{ id: "x", dueAmount: 0, date: "2026-01-01" }])
    expect(r.allocations).toHaveLength(0)
    expect(s(r.advance)).toBe("300.00")
  })

  it("keeps input order for invoices on the same day", () => {
    const r = allocateOldestFirst("150", [
      { id: "first", dueAmount: 100, date: "2026-09-01" },
      { id: "second", dueAmount: 100, date: "2026-09-01" },
    ])
    expect(r.allocations.map((a) => [a.invoiceId, s(a.amount)])).toEqual([
      ["first", "100.00"],
      ["second", "50.00"],
    ])
  })

  it("applies several advances across invoices oldest first", () => {
    const rows = applyAdvances(
      [
        { id: "adv1", remaining: "300" },
        { id: "adv2", remaining: "1000" },
      ],
      invoices,
    )
    expect(rows.map((r) => [r.receiptId, r.invoiceId, s(r.amount)])).toEqual([
      ["adv1", "a", "300.00"],
      ["adv2", "a", "700.00"],
      ["adv2", "b", "250.50"],
      ["adv2", "c", "49.50"],
    ])
  })

  it("never applies more than is due", () => {
    const rows = applyAdvances([{ id: "adv", remaining: "5000" }], invoices)
    const total = rows.reduce((a, r) => a + Number(r.amount), 0)
    expect(total).toBeCloseTo(1750.5, 2)
  })
})

describe("returnable quantity (SLS-06)", () => {
  it("subtracts approved and pending returns", () => {
    expect(returnableQty({ quantity: "10", returnedQty: "3", pendingQty: "2" }).toString()).toBe("5")
  })
  it("never goes negative", () => {
    expect(returnableQty({ quantity: 4, returnedQty: 3, pendingQty: 2 }).toString()).toBe("0")
  })
  it("handles fractional quantities (sqft, kg)", () => {
    expect(returnableQty({ quantity: "12.5", returnedQty: "2.25" }).toString()).toBe("10.25")
  })
})

describe("pro-rated return amount", () => {
  it("pro-rates the line discount", () => {
    // 3 × 1000 with 300 off → 900 per unit charged
    expect(s(returnLineAmount({ lineQty: 3, unitPrice: 1000, lineDiscount: 300, returnQty: 1 }))).toBe("900.00")
  })

  it("adds up exactly across partial returns (no stray paisa)", () => {
    const line = { lineQty: 3, unitPrice: 100, lineDiscount: 10 } // charged 290.00
    const first = returnLineAmount({ ...line, returnQty: 1 })
    const second = returnLineAmount({ ...line, returnQty: 1, alreadyReturnedQty: 1, alreadyReturnedAmount: first })
    const third = returnLineAmount({ ...line, returnQty: 1, alreadyReturnedQty: 2, alreadyReturnedAmount: first.plus(second) })
    expect([s(first), s(second), s(third)]).toEqual(["96.67", "96.67", "96.66"])
    expect(s(first.plus(second).plus(third))).toBe("290.00")
  })

  it("uses the stored line total when given", () => {
    expect(s(returnLineAmount({ lineQty: 4, unitPrice: 250, lineTotal: 900, returnQty: 2 }))).toBe("450.00")
  })

  it("applies the invoice-level charge factor", () => {
    // lines 2000, invoice total 1900 + 100 delivery → goods charged 1800 → factor 0.9
    const factor = chargeFactor({ lineTotals: [1500, 500], total: 1900, deliveryCharge: 100 })
    expect(factor.toString()).toBe("0.9")
    expect(s(returnLineAmount({ lineQty: 3, unitPrice: 500, returnQty: 1, factor }))).toBe("450.00")
  })

  it("factor is 1 for a plain invoice", () => {
    expect(chargeFactor({ lineTotals: [100, 200], total: 300 }).toString()).toBe("1")
  })

  it("restocks into batches newest-first, skipping what earlier returns already restored", () => {
    const allocs = [
      { batchId: "old", quantity: "5" },
      { batchId: "new", quantity: "3" },
    ]
    expect(restockableBatches(allocs, 0).map((a) => [a.batchId, a.quantity.toString()])).toEqual([
      ["old", "5"],
      ["new", "3"],
    ])
    expect(restockableBatches(allocs, 4).map((a) => [a.batchId, a.quantity.toString()])).toEqual([["old", "4"]])
  })

  it("marks the invoice returned only when every line is fully back", () => {
    expect(statusAfterReturn([{ quantity: 2, returnedQty: 2 }, { quantity: 1, returnedQty: 0 }])).toBe("partially_returned")
    expect(statusAfterReturn([{ quantity: 2, returnedQty: 2 }, { quantity: 1, returnedQty: 1 }])).toBe("returned")
  })
})

describe("credit note vs due reduction", () => {
  it("reduces the invoice due first", () => {
    const r = splitCreditNote(500, 800)
    expect([s(r.dueReduction), s(r.customerCredit)]).toEqual(["500.00", "0.00"])
  })
  it("keeps the excess as customer credit", () => {
    const r = splitCreditNote("1200", "450.25")
    expect([s(r.dueReduction), s(r.customerCredit)]).toEqual(["450.25", "749.75"])
  })
  it("never takes the due below zero", () => {
    const r = splitCreditNote(300, 0)
    expect([s(r.dueReduction), s(r.customerCredit)]).toEqual(["0.00", "300.00"])
    expect(s(splitCreditNote(300, -50).dueReduction)).toBe("0.00")
  })
  it("limits refund modes by invoice", () => {
    expect(allowedRefundModes({ type: "cash", customerId: null, dueAmount: 0 })).toEqual(["cash"])
    expect(allowedRefundModes({ type: "credit", customerId: "c1", dueAmount: 100 })).toEqual(["credit_note"])
    expect(allowedRefundModes({ type: "credit", customerId: "c1", dueAmount: 0 })).toEqual(["credit_note", "cash"])
    expect(allowedRefundModes({ type: "cash", customerId: "c1", dueAmount: 0 })).toEqual(["cash", "credit_note"])
  })
})

describe("orders & printing", () => {
  it("totals lines and the order discount", () => {
    const t = orderTotals(
      [
        { quantity: 2, unitPrice: 1250.5, discount: 1 },
        { quantity: "1.5", unitPrice: 800 },
      ],
      100,
    )
    expect(t.lineTotals.map(s)).toEqual(["2500.00", "1200.00"])
    expect([s(t.subtotal), s(t.total)]).toEqual(["3700.00", "3600.00"])
  })
  it("writes amounts in words with lakh/crore", () => {
    expect(amountInWords(123456.5)).toBe("Taka One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paisa Only")
    expect(amountInWords(25000000)).toBe("Taka Two Crore Fifty Lakh Only")
    expect(amountInWords(0)).toBe("Taka Zero Only")
    expect(amountInWords(1005)).toBe("Taka One Thousand Five Only")
  })
})
