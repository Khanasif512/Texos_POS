import { describe, expect, it } from "vitest"
import { isLowStock, mergeLines, splitAdjustment, stockValue, transferActions, transferProblem } from "@/server/modules/inventory-ops/calc"

const scope = { userBranchIds: ["HO", "CTG"], activeBranchIds: ["HO", "CTG", "WH1"] }
const t = (from: string, to: string, lines = [{ variationId: "v1", quantity: 2 }]) => ({ fromBranchId: from, toBranchId: to, lines })

describe("transfer validation", () => {
  it("accepts a transfer from an own branch to any active branch", () => {
    expect(transferProblem(t("HO", "WH1"), scope)).toBeNull()
    expect(transferProblem(t("CTG", "HO"), scope)).toBeNull()
  })
  it("rejects same branch, foreign source, inactive destination, empty or zero lines", () => {
    expect(transferProblem(t("HO", "HO"), scope)).toMatch(/different/)
    expect(transferProblem(t("WH1", "HO"), scope)).toMatch(/source branch/)
    expect(transferProblem(t("HO", "OLD"), scope)).toMatch(/not an active/)
    expect(transferProblem(t("HO", "CTG", []), scope)).toMatch(/at least one/)
    expect(transferProblem(t("HO", "CTG", [{ variationId: "v1", quantity: 0 }]), scope)).toMatch(/more than zero/)
  })
  it("only the destination can receive and only the source can cancel, while pending", () => {
    const tr = { status: "pending" as const, fromBranchId: "HO", toBranchId: "WH1" }
    expect(transferActions(tr, ["HO"])).toEqual({ canReceive: false, canCancel: true })
    expect(transferActions(tr, ["WH1"])).toEqual({ canReceive: true, canCancel: false })
    expect(transferActions({ ...tr, status: "completed" }, ["HO", "WH1"])).toEqual({ canReceive: false, canCancel: false })
  })
})

describe("line helpers", () => {
  it("merges duplicate variations", () => {
    const m = mergeLines([
      { variationId: "a", quantity: 2 },
      { variationId: "b", quantity: 1 },
      { variationId: "a", quantity: "0.5" },
    ])
    expect(m.map((l) => [l.variationId, l.qty.toNumber()])).toEqual([
      ["a", 2.5],
      ["b", 1],
    ])
  })
  it("splits signed adjustments into in/out", () => {
    const s = splitAdjustment([{ quantity: 5 }, { quantity: -2 }, { quantity: "-0.5" }])
    expect(s.ins).toHaveLength(1)
    expect(s.outs).toHaveLength(2)
  })
  it("values stock at batch cost (2 dp)", () => {
    expect(stockValue([{ qtyAvailable: 100, unitCost: "173.6667" }, { qtyAvailable: 3, unitCost: "264.6667" }]).toString()).toBe("18160.67")
  })
  it("flags low stock only when a reorder level is set", () => {
    expect(isLowStock(5, 10)).toBe(true)
    expect(isLowStock(10, 10)).toBe(true)
    expect(isLowStock(11, 10)).toBe(false)
    expect(isLowStock(0, 0)).toBe(false)
  })
})
