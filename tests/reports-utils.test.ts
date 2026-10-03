import { describe, expect, it } from "vitest"
import {
  ageDues,
  agingBucket,
  capRows,
  computeTotals,
  daysBetween,
  displayDate,
  excelColumnWidth,
  excelNumFmt,
  excelValue,
  exportFileName,
  isYmd,
  pct,
  periodKeys,
  quickRanges,
  rangeLabel,
  resolveRange,
  sumColumn,
  visibleColumns,
} from "@/server/modules/reports/utils"
import type { ReportColumn } from "@/server/modules/reports/types"

const today = new Date(2026, 9, 4) // 04 Oct 2026, local

describe("date presets", () => {
  const p = Object.fromEntries(quickRanges(today).map((r) => [r.key, r]))
  it("covers today, yesterday, months and years", () => {
    expect(p.today).toMatchObject({ from: "2026-10-04", to: "2026-10-04" })
    expect(p.yesterday).toMatchObject({ from: "2026-10-03", to: "2026-10-03" })
    expect(p.last_7).toMatchObject({ from: "2026-09-28", to: "2026-10-04" })
    expect(p.this_month).toMatchObject({ from: "2026-10-01", to: "2026-10-04" })
    expect(p.last_month).toMatchObject({ from: "2026-09-01", to: "2026-09-30" })
    expect(p.this_year).toMatchObject({ from: "2026-01-01", to: "2026-10-04" })
    expect(p.last_year).toMatchObject({ from: "2025-01-01", to: "2025-12-31" })
  })
  it("handles January (last month is December of the previous year)", () => {
    const jan = Object.fromEntries(quickRanges(new Date(2027, 0, 15)).map((r) => [r.key, r]))
    expect(jan.last_month).toMatchObject({ from: "2026-12-01", to: "2026-12-31" })
  })
  it("handles leap-year February", () => {
    const mar = Object.fromEntries(quickRanges(new Date(2028, 2, 2)).map((r) => [r.key, r]))
    expect(mar.last_month).toMatchObject({ from: "2028-02-01", to: "2028-02-29" })
  })
})

describe("range resolution", () => {
  it("falls back to the report default", () => {
    expect(resolveRange(undefined, undefined, "this_month", today)).toEqual({ from: "2026-10-01", to: "2026-10-04", isDefault: true })
    expect(resolveRange(undefined, undefined, "today", today)).toMatchObject({ from: "2026-10-04", to: "2026-10-04" })
  })
  it("swaps reversed ranges and fills a missing end", () => {
    expect(resolveRange("2026-10-04", "2026-09-01", "today", today)).toMatchObject({ from: "2026-09-01", to: "2026-10-04" })
    expect(resolveRange("2026-09-15", undefined, "today", today)).toMatchObject({ from: "2026-09-15", to: "2026-10-04" })
    expect(resolveRange(undefined, "2026-08-31", "today", today)).toMatchObject({ from: "2026-08-31", to: "2026-08-31" })
  })
  it("rejects malformed and impossible dates", () => {
    expect(isYmd("2026-02-30")).toBe(false)
    expect(isYmd("2026-2-3")).toBe(false)
    expect(isYmd("2026-10-04' OR 1=1")).toBe(false)
    expect(resolveRange("garbage", "2026-13-01", "this_month", today).isDefault).toBe(true)
  })
  it("lists period keys and labels them", () => {
    expect(periodKeys("2026-09-29", "2026-10-02", "day")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"])
    expect(periodKeys("2025-11-15", "2026-02-01", "month")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
    expect(displayDate("2026-10-04")).toBe("04 Oct 2026")
    expect(displayDate("2026-10")).toBe("Oct 2026")
    expect(rangeLabel("2026-10-04", "2026-10-04")).toBe("04 Oct 2026")
    expect(rangeLabel("2026-09-01", "2026-10-04")).toBe("01 Sep 2026 – 04 Oct 2026")
  })
})

describe("aging buckets", () => {
  it("puts boundaries in the right bucket", () => {
    expect(agingBucket(0)).toBe("b0_30")
    expect(agingBucket(30)).toBe("b0_30")
    expect(agingBucket(31)).toBe("b31_60")
    expect(agingBucket(60)).toBe("b31_60")
    expect(agingBucket(61)).toBe("b61_90")
    expect(agingBucket(90)).toBe("b61_90")
    expect(agingBucket(91)).toBe("b90")
    expect(agingBucket(400)).toBe("b90")
    expect(agingBucket(-3)).toBe("b0_30") // future-dated invoice
  })
  it("ages dues exactly against an as-of date", () => {
    expect(daysBetween("2026-07-06", "2026-10-04")).toBe(90)
    const aged = ageDues(
      [
        { invoiceDate: "2026-10-01", due: "1000.10" },
        { invoiceDate: "2026-09-04", due: 200.2 },
        { invoiceDate: "2026-08-20", due: "0.1" },
        { invoiceDate: "2026-07-06", due: "50" },
        { invoiceDate: "2026-07-05", due: "0.2" },
        { invoiceDate: "2025-01-01", due: "0.1" },
      ],
      "2026-10-04",
    )
    expect(aged).toEqual({ b0_30: 1200.3, b31_60: 0.1, b61_90: 50, b90: 0.3 })
  })
})

describe("totals", () => {
  const columns: ReportColumn[] = [
    { key: "name", label: "Name" },
    { key: "qty", label: "Qty", type: "qty", total: true },
    { key: "amount", label: "Amount", type: "money", total: true },
    { key: "margin", label: "Margin", type: "percent" },
    { key: "cost", label: "Cost", type: "money", total: true, cost: true },
  ]
  const rows = [
    { name: "A", qty: 1.001, amount: 0.1, margin: 10, cost: 5 },
    { name: "B", qty: 2.002, amount: 0.2, margin: 20, cost: null },
    { name: "C", qty: null, amount: "0.3", margin: 30, cost: 1.15 },
  ]
  it("sums decimals exactly (no float drift) and labels the first text column", () => {
    expect(computeTotals(columns, rows)).toEqual({ name: "Total", qty: 3.003, amount: 0.6, cost: 6.15 })
    expect(sumColumn([{ v: 0.1 }, { v: 0.2 }], "v")).toBe(0.3)
  })
  it("returns null when no column totals", () => {
    expect(computeTotals([{ key: "a", label: "A" }], [{ a: 1 }])).toBeNull()
  })
  it("hides cost columns without permission", () => {
    expect(visibleColumns(columns, false).map((c) => c.key)).toEqual(["name", "qty", "amount", "margin"])
    expect(visibleColumns(columns, true)).toHaveLength(5)
  })
  it("percentages guard against zero", () => {
    expect(pct(25, 200)).toBe(12.5)
    expect(pct(1, 3)).toBe(33.33)
    expect(pct(5, 0)).toBe(0)
  })
  it("caps rows and reports the matched count", () => {
    expect(capRows([1, 2, 3], 5)).toEqual({ rows: [1, 2, 3] })
    expect(capRows([1, 2, 3, 4], 2)).toEqual({ rows: [1, 2], totalRows: 4 })
  })
})

describe("excel formatting", () => {
  it("chooses number formats per column type", () => {
    expect(excelNumFmt("money")).toBe("#,##0.00;[Red]-#,##0.00")
    expect(excelNumFmt("qty")).toBe("#,##0.###")
    expect(excelNumFmt("int")).toBe("#,##0")
    expect(excelNumFmt("percent")).toBe('0.00"%"')
    expect(excelNumFmt("date")).toBe("dd mmm yyyy")
    expect(excelNumFmt("text")).toBeUndefined()
    expect(excelNumFmt(undefined)).toBeUndefined()
  })
  it("writes real numbers and dates, not strings", () => {
    expect(excelValue("money", "1234.50")).toBe(1234.5)
    expect(excelValue("int", 7)).toBe(7)
    expect(excelValue("money", null)).toBeNull()
    expect(excelValue("text", 12)).toBe(12)
    expect(excelValue("text", "INV-1")).toBe("INV-1")
    const d = excelValue("date", "2026-10-04") as Date
    expect(d.toISOString()).toBe("2026-10-04T00:00:00.000Z")
  })
  it("sizes columns between sensible bounds", () => {
    const text: ReportColumn = { key: "t", label: "Customer" }
    expect(excelColumnWidth(text, [{ t: "A" }])).toBe(10)
    expect(excelColumnWidth(text, [{ t: "x".repeat(200) }])).toBe(50)
    const money: ReportColumn = { key: "m", label: "Amount", type: "money" }
    expect(excelColumnWidth(money, [{ m: 1234567.5 }])).toBeGreaterThanOrEqual(12)
  })
  it("builds safe file names", () => {
    expect(exportFileName("sales", "2026-10-01", "2026-10-31")).toBe("sales_2026-10-01_2026-10-31.xlsx")
    expect(exportFileName("stock-balance", "2026-10-04", null)).toBe("stock-balance_2026-10-04.xlsx")
    expect(exportFileName("a/b", "2026-10-04", "2026-10-04")).toBe("a-b_2026-10-04.xlsx")
  })
})

describe("share totals", () => {
  it("absorbs rounding so shares total exactly 100%", () => {
    const cols: ReportColumn[] = [
      { key: "k", label: "K" },
      { key: "share", label: "Share", type: "percent", total: true },
    ]
    expect(computeTotals(cols, [{ k: "a", share: 33.34 }, { k: "b", share: 33.34 }, { k: "c", share: 33.33 }])?.share).toBe(100)
    expect(computeTotals(cols, [{ k: "a", share: 40 }])?.share).toBe(40)
  })
})
