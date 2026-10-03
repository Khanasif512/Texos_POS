import { describe, expect, it } from "vitest"
import { addDays, computeCashDay, dayKeysBetween, dbDate, dbDateKey, monthRange, openingCashFor, total } from "@/server/modules/finance/calc"

describe("daily cash closing (FIN-01)", () => {
  it("expected = opening + sales + receipts − expenses − payouts", () => {
    const r = computeCashDay({ openingCash: "12500.00", cashSales: "48250.50", cashReceipts: "15000", cashExpenses: "3420.75", cashPayouts: "20000" })
    expect(r.cashIn.toFixed(2)).toBe("63250.50")
    expect(r.cashOut.toFixed(2)).toBe("23420.75")
    expect(r.expectedClosing.toFixed(2)).toBe("52329.75")
    expect(r.countedCash).toBeNull()
    expect(r.difference).toBeNull()
    expect(r.status).toBe("open")
  })

  it("reports over / short / balanced against the counted cash", () => {
    const base = { openingCash: 1000, cashSales: 500, cashReceipts: 0, cashExpenses: 200, cashPayouts: 0 }
    expect(computeCashDay({ ...base, countedCash: 1300 }).status).toBe("balanced")
    const over = computeCashDay({ ...base, countedCash: "1350.25" })
    expect(over.status).toBe("over")
    expect(over.difference!.toFixed(2)).toBe("50.25")
    const short = computeCashDay({ ...base, countedCash: 1250 })
    expect(short.status).toBe("short")
    expect(short.difference!.toFixed(2)).toBe("-50.00")
  })

  it("is exact with decimal amounts (no float drift)", () => {
    const r = computeCashDay({ openingCash: "0.10", cashSales: "0.20", cashReceipts: 0, cashExpenses: 0, cashPayouts: 0, countedCash: "0.30" })
    expect(r.expectedClosing.toFixed(2)).toBe("0.30")
    expect(r.status).toBe("balanced")
  })

  it("treats missing aggregates (null sums) as zero", () => {
    const r = computeCashDay({ openingCash: null, cashSales: null, cashReceipts: undefined, cashExpenses: null, cashPayouts: total([null, "150"]) })
    expect(r.expectedClosing.toFixed(2)).toBe("-150.00")
  })

  it("opening cash carries forward the previous counted cash; first closing uses the entered opening", () => {
    expect(openingCashFor({ countedCash: "8450.00" }, 999).openingCash.toFixed(2)).toBe("8450.00")
    expect(openingCashFor({ countedCash: "8450.00" }).isFirst).toBe(false)
    const first = openingCashFor(null, "5000")
    expect(first.isFirst).toBe(true)
    expect(first.openingCash.toFixed(2)).toBe("5000.00")
    expect(openingCashFor(undefined).openingCash.toFixed(2)).toBe("0.00")
  })
})

describe("business-day helpers", () => {
  it("stores @db.Date values at UTC midnight so the day never shifts", () => {
    expect(dbDate("2026-10-03").toISOString()).toBe("2026-10-03T00:00:00.000Z")
    expect(dbDateKey(dbDate("2026-02-28"))).toBe("2026-02-28")
  })
  it("walks days and months across boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
    expect(dayKeysBetween("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"])
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" })
  })
})
