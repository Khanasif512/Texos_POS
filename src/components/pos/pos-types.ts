/** Client-side POS types and display math. The server recomputes every amount with Decimal (source of truth). */

export type CartLine = {
  variationId: string
  productName: string
  name: string
  sku: string
  barcode: string | null
  unit: string
  /** stock at the selected branch when the line was added */
  stock: number
  listPrice: number
  /** editable inputs kept as strings so typing "12." works */
  qty: string
  price: string
  discount: string
}

export type Salesman = { id: string; name: string; designation: string | null; employeeCode: string | null }

export type OrderPreload = {
  id: string
  number: string
  type: string
  branchId: string
  customer: import("@/components/shared/pickers").CustomerOption | null
  discount: number
  note: string | null
  salesmanId: string | null
  lines: CartLine[]
}

export const toNum = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function lineAmounts(l: CartLine) {
  const qty = toNum(l.qty)
  const price = toNum(l.price)
  const discount = toNum(l.discount)
  const gross = r2(qty * price)
  return { qty, price, discount, gross, total: r2(gross - discount) }
}

export function cartTotals(lines: CartLine[], adj: { discount: string; tax: string; delivery: string }) {
  const rows = lines.map(lineAmounts)
  const subtotal = r2(rows.reduce((a, r) => a + r.total, 0))
  const lineDiscount = r2(rows.reduce((a, r) => a + r.discount, 0))
  const discount = r2(toNum(adj.discount))
  const tax = r2(toNum(adj.tax))
  const delivery = r2(toNum(adj.delivery))
  const items = rows.reduce((a, r) => a + r.qty, 0)
  return { subtotal, lineDiscount, discount, tax, delivery, total: r2(subtotal - discount + tax + delivery), items }
}
