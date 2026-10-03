import { describe, expect, it } from "vitest"
import { canEditPo, cancelRemainder, extendedTotal, lineRemaining, poStatusFor, receiptQtyProblem, toBdt } from "@/server/modules/purchasing/calc"

const line = (quantity: number, receivedQty = 0, cancelledQty = 0) => ({ quantity, receivedQty, cancelledQty })

describe("PO line remaining quantity", () => {
  it("subtracts received and cancelled, never negative", () => {
    expect(lineRemaining(line(100, 40)).toNumber()).toBe(60)
    expect(lineRemaining(line(100, 40, 60)).toNumber()).toBe(0)
    expect(lineRemaining(line(10, 12)).toNumber()).toBe(0)
    expect(lineRemaining({ quantity: "2.5", receivedQty: "0.75", cancelledQty: 0 }).toString()).toBe("1.75")
  })
})

describe("PO status (PO-02)", () => {
  it("pending when nothing received", () => expect(poStatusFor([line(10), line(5)])).toBe("pending"))
  it("partially received while something is open", () => expect(poStatusFor([line(10, 10), line(5, 2)])).toBe("partially_received"))
  it("received when everything arrived", () => expect(poStatusFor([line(10, 10), line(5, 5)])).toBe("received"))
  it("received when the remainder was cancelled", () => expect(poStatusFor([line(10, 4, 6)])).toBe("received"))
  it("cancelled when nothing arrived and nothing is open", () => expect(poStatusFor([line(10, 0, 10)])).toBe("cancelled"))
})

describe("PO cancel (PO-03)", () => {
  it("cancels a pending order completely", () => {
    const r = cancelRemainder("pending", [line(10), line(3)])
    expect("error" in r).toBe(false)
    if ("error" in r) return
    expect(r.status).toBe("cancelled")
    expect(r.lines.map((l) => l.cancelledQty.toNumber())).toEqual([10, 3])
  })
  it("cancels only the unreceived remainder of a partial order", () => {
    const r = cancelRemainder("partially_received", [line(10, 4), line(3, 3)])
    if ("error" in r) throw new Error(r.error)
    expect(r.status).toBe("received")
    expect(r.lines.map((l) => l.cancelledQty.toNumber())).toEqual([6, 0])
  })
  it("refuses received or cancelled orders", () => {
    expect("error" in cancelRemainder("received", [line(1, 1)])).toBe(true)
    expect("error" in cancelRemainder("cancelled", [line(1, 0, 1)])).toBe(true)
  })
})

describe("PO editing and pricing", () => {
  it("is editable only while pending with nothing received", () => {
    expect(canEditPo("pending", [line(5)])).toBe(true)
    expect(canEditPo("pending", [line(5, 1)])).toBe(false)
    expect(canEditPo("partially_received", [line(5, 1)])).toBe(false)
  })
  it("converts foreign prices with the exchange rate (4 dp)", () => {
    expect(toBdt("12.5", "BDT", 1).toString()).toBe("12.5")
    expect(toBdt("1.2345", "USD", "121.5").toString()).toBe("149.9918")
    expect(toBdt(10, "RMB", "16.6667").toString()).toBe("166.667")
  })
  it("extended total rounds each line to paisa", () => {
    expect(extendedTotal([{ quantity: 3, unitCost: "33.3333" }, { quantity: "1.5", unitCost: 10 }]).toString()).toBe("115")
  })
})

describe("receipt quantity validation", () => {
  it("allows partial and full receipt, rejects over-receipt", () => {
    expect(receiptQtyProblem(10, 4)).toBeNull()
    expect(receiptQtyProblem(10, 10)).toBeNull()
    expect(receiptQtyProblem(10, "10.001", "Glass 5mm")).toBe("Only 10 left to receive for Glass 5mm")
    expect(receiptQtyProblem(10, -1)).toMatch(/negative/)
  })
})
