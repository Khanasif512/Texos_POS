/**
 * Landed-cost distribution engine (SRS LC-03 … LC-05, §8 worked example).
 *
 * Pure and deterministic: no database, no I/O, decimal arithmetic only (never JS floats).
 *
 *   base unit cost (BDT)  = unit price (foreign) × exchange rate                    → 4 dp
 *   total extra cost      = Σ all LC cost items (product purchase value is the base, not a cost item)
 *   line share (ratio)    = weight basis:   unit weight × qty / Σ(unit weight × qty)
 *                           quantity basis: qty / Σ qty
 *   line extra total      = total extra × ratio                                      → 2 dp
 *                           rounding residue goes to the line with the largest share, so
 *                           Σ line extra totals == total extra cost exactly (LC-04 acceptance)
 *   extra unit cost       = line extra total / qty                                   → 4 dp
 *   landed unit cost      = base unit cost + extra unit cost                         → 4 dp
 */
import Decimal from "decimal.js"

/** Local high-precision decimal (40 significant digits, half-up) so intermediate ratios never lose cents. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP })
export type D = InstanceType<typeof D>

type Num = number | string | { toString(): string }

export type DistributionBasis = "weight" | "quantity"

export type EngineLine = {
  lcLineId: string
  variationId: string
  quantity: Num
  unitWeight: Num
  unitPriceForeign: Num
}

export type EngineCostItem = { id?: string; costType: string; amount: Num }

export type EngineInput = {
  lines: EngineLine[]
  exchangeRate: Num
  costItems: EngineCostItem[]
  basis: DistributionBasis
}

export type EngineLineResult = {
  lcLineId: string
  variationId: string
  quantity: D
  unitWeight: D
  unitPriceForeign: D
  /** quantity × unit price (foreign), 4 dp */
  lineValueForeign: D
  /** quantity × unit weight */
  lineWeight: D
  /** share of the total extra cost, 0..1 (full precision; store at 10 dp) */
  ratio: D
  baseUnitCost: D
  /** quantity × unit price × rate, 2 dp */
  baseTotal: D
  extraCostTotal: D
  extraUnitCost: D
  landedUnitCost: D
  /** base total + extra cost total, 2 dp */
  landedTotal: D
}

export type EngineResult = {
  basis: DistributionBasis
  exchangeRate: D
  lines: EngineLineResult[]
  totalQuantity: D
  totalWeight: D
  totalValueForeign: D
  totalBaseCost: D
  totalExtraCost: D
  totalLandedCost: D
  /** non-fatal notices, e.g. a line without unit weight gets no share under weight basis */
  warnings: { lcLineId: string; message: string }[]
}

export type EngineErrorCode = "NO_LINES" | "ZERO_RATE" | "ZERO_WEIGHT" | "ZERO_QUANTITY" | "INVALID_LINE"

export class LcEngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "LcEngineError"
  }
}

const d = (v: Num | null | undefined) => new D(v == null || v === "" ? 0 : v.toString())
const r2 = (v: D) => v.toDecimalPlaces(2, D.ROUND_HALF_UP)
const r4 = (v: D) => v.toDecimalPlaces(4, D.ROUND_HALF_UP)

/**
 * Split `total` (2 dp) in proportion to `weights`; each part is rounded to 2 dp and the residue
 * (a few ±0.01) is added to the part with the largest weight (first one on ties) so Σ parts == total.
 */
export function distribute(total: Num, weights: Num[]): D[] {
  const t = r2(d(total))
  const w = weights.map(d)
  const sumW = w.reduce((a, b) => a.plus(b), new D(0))
  if (w.length === 0) return []
  if (sumW.lte(0)) throw new LcEngineError("ZERO_WEIGHT", "Cannot distribute: the total of the shares is zero.")
  const parts = w.map((x) => r2(t.times(x).div(sumW)))
  const residue = t.minus(parts.reduce((a, b) => a.plus(b), new D(0)))
  if (!residue.isZero()) {
    let largest = 0
    for (let i = 1; i < w.length; i++) if (w[i].gt(w[largest])) largest = i
    parts[largest] = parts[largest].plus(residue)
  }
  return parts
}

/** Total extra cost = Σ cost item amounts (2 dp). */
export function totalExtraCost(costItems: EngineCostItem[]) {
  return r2(costItems.reduce((a, c) => a.plus(d(c.amount)), new D(0)))
}

export function calculateLandedCost(input: EngineInput): EngineResult {
  const { basis } = input
  if (!input.lines.length) throw new LcEngineError("NO_LINES", "Add at least one product line to the LC before calculating landed cost.")
  const rate = d(input.exchangeRate)
  if (rate.lte(0)) throw new LcEngineError("ZERO_RATE", "Enter the exchange rate (foreign currency → BDT) before calculating landed cost.")

  const lines = input.lines.map((l) => {
    const quantity = d(l.quantity)
    const unitWeight = d(l.unitWeight)
    const unitPriceForeign = d(l.unitPriceForeign)
    if (quantity.lte(0)) throw new LcEngineError("INVALID_LINE", "Every product line needs a quantity greater than zero.")
    if (unitWeight.lt(0) || unitPriceForeign.lt(0)) throw new LcEngineError("INVALID_LINE", "Unit weight and unit price cannot be negative.")
    return { ...l, quantity, unitWeight, unitPriceForeign, lineWeight: quantity.times(unitWeight) }
  })

  const totalQuantity = lines.reduce((a, l) => a.plus(l.quantity), new D(0))
  const totalWeight = lines.reduce((a, l) => a.plus(l.lineWeight), new D(0))
  if (basis === "weight" && totalWeight.lte(0))
    throw new LcEngineError(
      "ZERO_WEIGHT",
      "Total weight is zero. Set the unit weight (kg) on the LC product lines, or use the quantity basis.",
    )
  if (totalQuantity.lte(0)) throw new LcEngineError("ZERO_QUANTITY", "Total quantity is zero.")

  const measures = lines.map((l) => (basis === "weight" ? l.lineWeight : l.quantity))
  const totalMeasure = basis === "weight" ? totalWeight : totalQuantity
  const extra = totalExtraCost(input.costItems)
  const extraParts = distribute(extra, measures)

  const warnings: EngineResult["warnings"] = []
  const out: EngineLineResult[] = lines.map((l, i) => {
    if (basis === "weight" && l.unitWeight.isZero())
      warnings.push({ lcLineId: l.lcLineId, message: "No unit weight set — this line receives no share of the extra cost under weight basis." })
    const baseUnitCost = r4(l.unitPriceForeign.times(rate))
    const extraCostTotal = extraParts[i]
    const extraUnitCost = r4(extraCostTotal.div(l.quantity))
    const baseTotal = r2(l.quantity.times(l.unitPriceForeign).times(rate))
    return {
      lcLineId: l.lcLineId,
      variationId: l.variationId,
      quantity: l.quantity,
      unitWeight: l.unitWeight,
      unitPriceForeign: l.unitPriceForeign,
      lineValueForeign: r4(l.quantity.times(l.unitPriceForeign)),
      lineWeight: l.lineWeight,
      ratio: measures[i].div(totalMeasure),
      baseUnitCost,
      baseTotal,
      extraCostTotal,
      extraUnitCost,
      landedUnitCost: r4(baseUnitCost.plus(extraUnitCost)),
      landedTotal: r2(baseTotal.plus(extraCostTotal)),
    }
  })

  const totalBaseCost = r2(lines.reduce((a, l) => a.plus(l.quantity.times(l.unitPriceForeign).times(rate)), new D(0)))
  return {
    basis,
    exchangeRate: rate,
    lines: out,
    totalQuantity,
    totalWeight,
    totalValueForeign: r4(lines.reduce((a, l) => a.plus(l.quantity.times(l.unitPriceForeign)), new D(0))),
    totalBaseCost,
    totalExtraCost: extra,
    totalLandedCost: r2(totalBaseCost.plus(extra)),
    warnings,
  }
}

/**
 * LC acceptance criterion 3: which cost items contributed what to one line.
 * Each item's contribution = item amount × line ratio (2 dp for the line, 4 dp per unit).
 * Individual contributions are rounded independently, so their sum can differ from the
 * line's extra total by the rounding residue (shown separately).
 */
export function lineBreakdown(line: Pick<EngineLineResult, "ratio" | "quantity" | "extraCostTotal">, costItems: EngineCostItem[]) {
  const items = costItems.map((c) => {
    const exact = d(c.amount).times(line.ratio)
    return { ...c, amount: d(c.amount), lineAmount: r2(exact), unitAmount: r4(exact.div(line.quantity)) }
  })
  const allocated = items.reduce((a, c) => a.plus(c.lineAmount), new D(0))
  return { items, rounding: line.extraCostTotal.minus(allocated) }
}
