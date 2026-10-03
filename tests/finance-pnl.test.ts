import { describe, expect, it } from "vitest"
import { computePnl, monthKeysOfYear, pnlByPeriod, resolvePeriod } from "@/server/modules/finance/calc"

describe("profit & loss (FIN-02)", () => {
  it("revenue − returns − COGS (net of returned cost) − opex = net profit", () => {
    const p = computePnl({
      sales: "250000.00",
      salesCost: "180000.00",
      returns: "10000.00",
      returnsCost: "7200.00",
      expenses: [
        { key: "rent", name: "Office Rent", amount: "25000" },
        { key: "sal", name: "Staff Salary", amount: "18000" },
        { key: "util", name: "Utility Bills", amount: "2350.50" },
      ],
    })
    expect(p.netRevenue.toFixed(2)).toBe("240000.00")
    expect(p.cogs.toFixed(2)).toBe("172800.00")
    expect(p.grossProfit.toFixed(2)).toBe("67200.00")
    expect(p.grossMargin).toBe(28)
    expect(p.operatingExpenses.toFixed(2)).toBe("45350.50")
    expect(p.netProfit.toFixed(2)).toBe("21849.50")
    expect(p.netMargin).toBe(9.1)
    // expenses sorted largest first
    expect(p.expenses.map((e) => e.name)).toEqual(["Office Rent", "Staff Salary", "Utility Bills"])
  })

  it("merges duplicate categories, drops zero lines and handles no revenue", () => {
    const p = computePnl({
      sales: null,
      salesCost: null,
      returns: null,
      returnsCost: null,
      expenses: [
        { key: "a", name: "Entertainment", amount: "500" },
        { key: "a", name: "Entertainment", amount: "250.25" },
        { key: "b", name: "Other", amount: 0 },
      ],
    })
    expect(p.expenses).toHaveLength(1)
    expect(p.expenses[0].amount.toFixed(2)).toBe("750.25")
    expect(p.netProfit.toFixed(2)).toBe("-750.25")
    expect(p.grossMargin).toBeNull()
    expect(p.netMargin).toBeNull()
  })

  it("builds month-by-month rows in calendar order with zero months filled", () => {
    const rows = pnlByPeriod(monthKeysOfYear(2026), [
      { key: "2026-03", sales: "1000", salesCost: "600" },
      { key: "2026-03", expenses: "150" },
      { key: "2026-03", returns: "100", returnsCost: "60" },
      { key: "2026-07", expenses: "80" },
      { key: "2025-12", sales: "999" }, // outside the year — ignored
    ])
    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({ key: "2026-01", netRevenue: 0, netProfit: 0, grossMargin: null })
    expect(rows[2]).toMatchObject({ key: "2026-03", netRevenue: 900, cogs: 540, grossProfit: 360, expenses: 150, netProfit: 210, grossMargin: 40 })
    expect(rows[6]).toMatchObject({ key: "2026-07", netProfit: -80 })
  })
})

describe("P&L period selector", () => {
  const today = "2026-10-03"
  const q = (o: Record<string, string>) => (k: string) => o[k]

  it("defaults to the current month", () => {
    expect(resolvePeriod(q({}), today)).toMatchObject({ kind: "month", from: "2026-10-01", to: "2026-10-31", label: "Oct 2026", year: 2026 })
  })
  it("supports a single day and a month", () => {
    expect(resolvePeriod(q({ period: "day", date: "2026-09-15" }), today)).toMatchObject({ from: "2026-09-15", to: "2026-09-15" })
    expect(resolvePeriod(q({ period: "month", month: "2026-02" }), today)).toMatchObject({ from: "2026-02-01", to: "2026-02-28" })
  })
  it("normalises a reversed or invalid custom range", () => {
    expect(resolvePeriod(q({ period: "range", from: "2026-09-30", to: "2026-09-01" }), today)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" })
    expect(resolvePeriod(q({ period: "range", from: "nope" }), today)).toMatchObject({ from: "2026-10-01", to: "2026-10-03" })
    expect(resolvePeriod(q({ period: "month", month: "2026-13" }), today).month).toBe("2026-10")
  })
  it("uses the requested year for the monthly table", () => {
    expect(resolvePeriod(q({ year: "2025" }), today).year).toBe(2025)
    expect(resolvePeriod(q({ year: "abc" }), today).year).toBe(2026)
  })
})
