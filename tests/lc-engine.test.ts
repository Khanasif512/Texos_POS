import { describe, expect, it } from "vitest"
import { calculateLandedCost, distribute, LcEngineError, lineBreakdown, totalExtraCost, type EngineInput } from "@/server/modules/lc/engine"

/** SRS §8 worked example — LC-2026-0091, Foshan Nanhai Guangjun Aluminium. */
const srsExample = (basis: EngineInput["basis"]): EngineInput => ({
  basis,
  exchangeRate: "16.50",
  lines: [
    { lcLineId: "A", variationId: "type-1", quantity: 2000, unitWeight: "0.5", unitPriceForeign: 8 },
    { lcLineId: "B", variationId: "type-2", quantity: 1000, unitWeight: "0.8", unitPriceForeign: 12 },
  ],
  costItems: [
    { costType: "lc_opening", amount: 15000 },
    { costType: "freight", amount: 40000 },
    { costType: "port", amount: 10000 },
    { costType: "cnf", amount: 8000 },
    { costType: "transport", amount: 12000 },
    { costType: "unloading", amount: 5000 },
    { costType: "customs_duty", amount: 60000 },
  ],
})

const fixed = (v: { toFixed(n: number): string }, dp = 2) => v.toFixed(dp)

describe("LC landed-cost engine — SRS §8 worked example", () => {
  it("weight basis gives 173.67 / 264.67 per piece", () => {
    const r = calculateLandedCost(srsExample("weight"))
    const [a, b] = r.lines

    expect(fixed(r.totalExtraCost)).toBe("150000.00")
    expect(fixed(r.totalWeight, 3)).toBe("1800.000")

    // Step 1 — base unit cost from FX
    expect(fixed(a.baseUnitCost, 4)).toBe("132.0000")
    expect(fixed(b.baseUnitCost, 4)).toBe("198.0000")

    // Step 2 — extra cost by weight (1000 kg vs 800 kg of 1800 kg)
    expect(fixed(a.ratio, 10)).toBe("0.5555555556")
    expect(fixed(b.ratio, 10)).toBe("0.4444444444")
    expect(fixed(a.extraCostTotal)).toBe("83333.33")
    expect(fixed(b.extraCostTotal)).toBe("66666.67")
    expect(fixed(a.extraCostTotal.plus(b.extraCostTotal))).toBe("150000.00")
    expect(fixed(a.extraUnitCost)).toBe("41.67")
    expect(fixed(b.extraUnitCost)).toBe("66.67")
    expect(fixed(a.extraUnitCost, 4)).toBe("41.6667")

    // Step 3 — final landed unit cost
    expect(fixed(a.landedUnitCost)).toBe("173.67")
    expect(fixed(b.landedUnitCost)).toBe("264.67")

    // totals
    expect(fixed(r.totalBaseCost)).toBe("462000.00")
    expect(fixed(r.totalLandedCost)).toBe("612000.00")
    expect(fixed(a.baseTotal)).toBe("264000.00")
    expect(fixed(b.baseTotal)).toBe("198000.00")
    expect(r.warnings).toEqual([])
  })

  it("quantity basis splits 150,000 by piece count: 100,000 / 50,000 → 50.00 per piece", () => {
    const r = calculateLandedCost(srsExample("quantity"))
    const [a, b] = r.lines
    expect(fixed(a.extraCostTotal)).toBe("100000.00")
    expect(fixed(b.extraCostTotal)).toBe("50000.00")
    expect(fixed(a.extraUnitCost)).toBe("50.00")
    expect(fixed(b.extraUnitCost)).toBe("50.00")
    expect(fixed(a.landedUnitCost)).toBe("182.00")
    expect(fixed(b.landedUnitCost)).toBe("248.00")
    expect(fixed(r.totalExtraCost)).toBe("150000.00")
  })

  it("the extra-cost portion is proportional to each line's total weight", () => {
    const r = calculateLandedCost(srsExample("weight"))
    const [a, b] = r.lines
    // 83,333.33 : 66,666.67 ≈ 1000 : 800
    expect(Number(a.extraCostTotal.div(b.extraCostTotal).toFixed(4))).toBeCloseTo(1000 / 800, 4)
  })

  it("explains per-line contributions of every cost item (acceptance criterion 3)", () => {
    const input = srsExample("weight")
    const r = calculateLandedCost(input)
    const { items, rounding } = lineBreakdown(r.lines[0], input.costItems)
    const freight = items.find((i) => i.costType === "freight")!
    expect(fixed(freight.lineAmount)).toBe("22222.22") // 40,000 × 1000/1800
    expect(fixed(freight.unitAmount, 4)).toBe("11.1111")
    const customs = items.find((i) => i.costType === "customs_duty")!
    expect(fixed(customs.lineAmount)).toBe("33333.33")
    const allocated = items.reduce((s, i) => s.plus(i.lineAmount), rounding.minus(rounding))
    expect(fixed(allocated.plus(rounding))).toBe(fixed(r.lines[0].extraCostTotal))
  })
})

describe("rounding residue", () => {
  it("100 split 3 ways sums exactly, residue goes to the largest share (first on a tie)", () => {
    const parts = distribute(100, [1, 1, 1]).map((p) => p.toFixed(2))
    expect(parts).toEqual(["33.34", "33.33", "33.33"])
  })

  it("residue lands on the largest line", () => {
    const parts = distribute(100, [1, 1, 2]).map((p) => p.toFixed(2))
    expect(parts).toEqual(["25.00", "25.00", "50.00"])
    const odd = distribute("0.05", [1, 1, 1, 3]).map((p) => p.toFixed(2))
    // raw: 0.00833, 0.00833, 0.00833, 0.025 → 0.01, 0.01, 0.01, 0.03 (sum 0.06) → largest gets −0.01
    expect(odd).toEqual(["0.01", "0.01", "0.01", "0.02"])
    expect(odd.reduce((s, v) => s + Math.round(Number(v) * 100), 0)).toBe(5)
  })

  it("Σ line extra totals always equals total extra cost exactly", () => {
    const lines = [7, 13, 29, 31, 101].map((q, i) => ({
      lcLineId: `L${i}`,
      variationId: `V${i}`,
      quantity: q,
      unitWeight: (i + 1) * 0.37,
      unitPriceForeign: 3.3,
    }))
    for (const total of ["100.00", "999.99", "12345.67", "0.01", "150000.00"]) {
      for (const basis of ["weight", "quantity"] as const) {
        const r = calculateLandedCost({ basis, exchangeRate: "16.5", lines, costItems: [{ costType: "other", amount: total }] })
        const s = r.lines.reduce((a, l) => a.plus(l.extraCostTotal), r.totalExtraCost.minus(r.totalExtraCost))
        expect(s.toFixed(2)).toBe(total)
        expect(r.lines.every((l) => l.extraCostTotal.decimalPlaces() <= 2)).toBe(true)
      }
    }
  })

  it("sums cost items without float error", () => {
    expect(totalExtraCost([{ costType: "a", amount: "0.1" }, { costType: "b", amount: "0.2" }]).toFixed(2)).toBe("0.30")
  })

  it("zero extra cost leaves landed = base", () => {
    const r = calculateLandedCost({ ...srsExample("weight"), costItems: [] })
    expect(r.lines[0].landedUnitCost.toFixed(4)).toBe("132.0000")
    expect(r.lines[0].extraCostTotal.toFixed(2)).toBe("0.00")
  })
})

describe("errors and warnings", () => {
  const expectCode = (fn: () => unknown, code: string) => {
    try {
      fn()
      throw new Error("expected an LcEngineError")
    } catch (e) {
      expect(e).toBeInstanceOf(LcEngineError)
      expect((e as LcEngineError).code).toBe(code)
    }
  }

  it("rejects an LC without lines", () => {
    expectCode(() => calculateLandedCost({ ...srsExample("weight"), lines: [] }), "NO_LINES")
  })

  it("rejects a zero exchange rate", () => {
    expectCode(() => calculateLandedCost({ ...srsExample("weight"), exchangeRate: 0 }), "ZERO_RATE")
  })

  it("asks for unit weights when total weight is zero under weight basis", () => {
    const input = srsExample("weight")
    input.lines = input.lines.map((l) => ({ ...l, unitWeight: 0 }))
    expectCode(() => calculateLandedCost(input), "ZERO_WEIGHT")
    expect(() => calculateLandedCost(input)).toThrow(/unit weight/i)
    // quantity basis still works without weights
    expect(calculateLandedCost({ ...input, basis: "quantity" }).lines[0].extraUnitCost.toFixed(2)).toBe("50.00")
  })

  it("rejects non-positive quantities", () => {
    const input = srsExample("quantity")
    input.lines[1] = { ...input.lines[1], quantity: 0 }
    expectCode(() => calculateLandedCost(input), "INVALID_LINE")
  })

  it("warns about a weightless line under weight basis", () => {
    const input = srsExample("weight")
    input.lines[1] = { ...input.lines[1], unitWeight: 0 }
    const r = calculateLandedCost(input)
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0].lcLineId).toBe("B")
    expect(r.lines[1].extraCostTotal.toFixed(2)).toBe("0.00")
    expect(r.lines[0].extraCostTotal.toFixed(2)).toBe("150000.00")
  })
})
