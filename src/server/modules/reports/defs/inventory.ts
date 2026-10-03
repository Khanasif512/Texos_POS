import "server-only"
import { ArrowLeftRight, Boxes, PackageSearch } from "lucide-react"
import { dec, num } from "@/server/decimal"
import type { ReportDef, RunCtx } from "../framework"
import { empty, inList, query, raw, ROW_CAP, sql, toIso, toNum, toYmd, type Sql } from "../sql"
import type { ReportColumn, ReportRow, ReportTable } from "../types"
import { computeTotals, pct } from "../utils"
import { categoryFilter, humanize } from "./common"

/** Branch columns for a product × branch matrix (only when more than one branch is in scope). */
function branchColumns(r: RunCtx) {
  if (r.branchIds.length < 2 || r.branchIds.length > 25) return []
  return r.branchIds.map((id, idx) => ({ id, key: `b${idx}`, name: r.branchName(id) }))
}

function branchSums(cols: { id: string; key: string }[], qtyCol: Sql, branchCol: Sql): Sql {
  return cols.reduce<Sql>((acc, c) => {
    if (!/^b\d{1,2}$/.test(c.key)) throw new Error("Invalid branch column alias")
    return sql`${acc}, SUM(CASE WHEN ${branchCol} = ${c.id} THEN ${qtyCol} ELSE 0 END) AS ${raw(c.key)}`
  }, empty)
}

const catWhere = (r: RunCtx) => {
  const cat = r.value("categoryId")
  return cat ? sql`AND p.categoryId = ${cat}` : empty
}

// ───────────── Inventory valuation (total / branch-wise) ─────────────

const inventoryValuation: ReportDef = {
  slug: "inventory-valuation",
  title: "Total / branch-wise inventory",
  description: "Stock on hand valued at landed cost (FIFO batches) per branch, product and category, company-wide.",
  group: "Inventory",
  icon: Boxes,
  perm: ["reports.stock", "reports.financial"],
  date: "none",
  landscape: true,
  filters: [
    {
      key: "view",
      label: "View",
      kind: "segment",
      default: "branch",
      options: [
        { value: "branch", label: "By branch" },
        { value: "product", label: "By product" },
        { value: "category", label: "By category" },
      ],
    },
    categoryFilter,
  ],
  run: async (r) => {
    const view = r.value("view")
    const base = sql`FROM inventory_batches b
      JOIN product_variations v ON v.id = b.variationId
      JOIN products p ON p.id = v.productId
      LEFT JOIN categories cat ON cat.id = p.categoryId
      WHERE b.companyId = ${r.companyId} AND b.branchId IN (${inList(r.branchIds)}) AND b.qtyAvailable > 0 ${catWhere(r)}`
    const [all] = await query<{ skus: bigint; qty: unknown; value: unknown; batches: bigint }>(
      sql`SELECT COUNT(DISTINCT b.variationId) AS skus, SUM(b.qtyAvailable) AS qty, SUM(b.qtyAvailable * b.unitCost) AS value, COUNT(*) AS batches ${base}`,
    )
    const totalValue = dec(all?.value as string).toDecimalPlaces(2)
    const summary = [
      { label: "Stock value", value: num(totalValue), type: "money" as const, hint: "At landed / purchase cost", cost: true },
      { label: "Quantity on hand", value: toNum(all?.qty), type: "qty" as const },
      { label: "SKUs in stock", value: toNum(all?.skus), type: "int" as const },
      { label: "Open batches", value: toNum(all?.batches), type: "int" as const, hint: `${r.branchIds.length} branch${r.branchIds.length === 1 ? "" : "es"} in scope` },
    ]
    const notes = ["Valued at the unit cost of each remaining FIFO batch (landed cost for LC goods). Figures are as of now."]

    if (view === "product") {
      const bcols = branchColumns(r)
      const rows = await query<Record<string, unknown>>(
        sql`SELECT b.variationId, MAX(v.sku) AS sku, MAX(p.name) AS product, MAX(v.name) AS variation, MAX(cat.name) AS category, MAX(p.unit) AS unit,
            SUM(b.qtyAvailable) AS qty, SUM(b.qtyAvailable * b.unitCost) AS value ${branchSums(bcols, sql`b.qtyAvailable`, sql`b.branchId`)}
          ${base} GROUP BY b.variationId ORDER BY value DESC LIMIT ${ROW_CAP + 1}`,
      )
      const out = rows.slice(0, ROW_CAP).map((x) => {
        const qty = dec(x.qty as string)
        const value = dec(x.value as string)
        const row: ReportRow = {
          sku: x.sku as string,
          product: x.product as string,
          variation: x.variation as string,
          category: (x.category as string) ?? "—",
          unit: x.unit as string,
        }
        for (const c of bcols) row[c.key] = toNum(x[c.key])
        row.qty = num(qty)
        row.avgCost = qty.isZero() ? 0 : num(value.div(qty).toDecimalPlaces(2))
        row.value = num(value.toDecimalPlaces(2))
        row.share = pct(value, totalValue)
        return row
      })
      const columns: ReportColumn[] = [
        { key: "sku", label: "SKU" },
        { key: "product", label: "Product" },
        { key: "variation", label: "Variation" },
        { key: "category", label: "Category" },
        { key: "unit", label: "Unit" },
        ...bcols.map((c) => ({ key: c.key, label: c.name, type: "qty" as const, total: true })),
        { key: "qty", label: "Total qty", type: "qty", total: true },
        { key: "avgCost", label: "Avg cost", type: "money", cost: true },
        { key: "value", label: "Stock value", type: "money", total: true, cost: true },
        { key: "share", label: "Share", type: "percent", total: true, cost: true },
      ]
      return {
        summary,
        notes,
        tables: [
          {
            key: "by-product",
            columns,
            rows: out,
            totals: rows.length > ROW_CAP ? { sku: "Total", qty: toNum(all?.qty), value: num(totalValue), share: 100 } : undefined,
            totalRows: rows.length > ROW_CAP ? toNum(all?.skus) : undefined,
            empty: "No stock on hand.",
          },
        ],
      }
    }

    const key = view === "category" ? sql`COALESCE(p.categoryId, '')` : sql`b.branchId`
    const [rows, bySource] = await Promise.all([
      query<{ k: string; label: string | null; skus: bigint; qty: unknown; value: unknown }>(
        sql`SELECT ${key} AS k, MAX(cat.name) AS label, COUNT(DISTINCT b.variationId) AS skus, SUM(b.qtyAvailable) AS qty,
            SUM(b.qtyAvailable * b.unitCost) AS value ${base} GROUP BY 1 ORDER BY value DESC`,
      ),
      view === "category"
        ? Promise.resolve([])
        : query<{ source: string; qty: unknown; value: unknown; batches: bigint }>(
            sql`SELECT b.source, SUM(b.qtyAvailable) AS qty, SUM(b.qtyAvailable * b.unitCost) AS value, COUNT(*) AS batches
              ${base} GROUP BY b.source ORDER BY value DESC`,
          ),
    ])
    const out = rows.map((x) => ({
      label: view === "category" ? (x.label ?? "Uncategorised") : r.branchName(x.k),
      skus: toNum(x.skus),
      qty: toNum(x.qty),
      value: num(dec(x.value as string).toDecimalPlaces(2)),
      share: pct(dec(x.value as string), totalValue),
    }))
    const columns: ReportColumn[] = [
      { key: "label", label: view === "category" ? "Category" : "Branch" },
      { key: "skus", label: "SKUs", type: "int" },
      { key: "qty", label: "Quantity", type: "qty", total: true },
      { key: "value", label: "Stock value", type: "money", total: true, cost: true },
      { key: "share", label: "Share", type: "percent", total: true, cost: true },
    ]
    const totals = computeTotals(columns, out)
    if (totals) totals.skus = toNum(all?.skus)
    const tables: ReportTable[] = [{ key: `by-${view}`, columns, rows: out, totals, empty: "No stock on hand." }]
    if (bySource.length)
      tables.push({
        key: "by-source",
        columns: [
          { key: "label", label: "Stock source" },
          { key: "skus", label: "Batches", type: "int" },
          { key: "qty", label: "Quantity", type: "qty", total: true },
          { key: "value", label: "Stock value", type: "money", total: true, cost: true },
          { key: "share", label: "Share", type: "percent", total: true, cost: true },
        ],
        rows: bySource.map((x) => ({
          label: SOURCE_LABEL[x.source] ?? humanize(x.source),
          skus: toNum(x.batches),
          qty: toNum(x.qty),
          value: num(dec(x.value as string).toDecimalPlaces(2)),
          share: pct(dec(x.value as string), totalValue),
        })),
        totals: null,
        empty: "",
      })
    if (tables[1]) tables[1].title = "By stock source"
    return {
      summary,
      notes,
      chart:
        out.length > 1
          ? { kind: "hbar", xKey: "label", series: [{ key: "value", label: "Stock value", cost: true }], data: out.slice(0, 12), valueType: "money" }
          : null,
      tables,
    }
  },
}

const SOURCE_LABEL: Record<string, string> = {
  lc: "LC import",
  purchase: "Local purchase",
  opening: "Opening stock",
  transfer: "Branch transfer",
  return: "Customer return",
  adjustment: "Adjustment",
}

// ───────────── Item-wise / balance stock ─────────────

const stockBalance: ReportDef = {
  slug: "stock-balance",
  title: "Item-wise balance stock",
  description: "Quantity available per SKU and branch with reorder alerts (low and out of stock).",
  group: "Inventory",
  icon: PackageSearch,
  perm: ["reports.stock"],
  date: "none",
  landscape: true,
  filters: [
    {
      key: "stock",
      label: "Stock status",
      kind: "select",
      allLabel: "All items",
      options: [
        { value: "in", label: "In stock" },
        { value: "low", label: "Low stock (reorder)" },
        { value: "out", label: "Out of stock" },
      ],
    },
    categoryFilter,
  ],
  run: async (r) => {
    const bcols = branchColumns(r)
    const status = r.value("stock")
    const grouped = sql`SELECT v.id, v.sku, p.name AS product, v.name AS variation, cat.name AS category, p.unit, v.reorderLevel, v.salePrice,
        COALESCE(SUM(sb.quantity), 0) AS qty ${branchSums(bcols, sql`sb.quantity`, sql`sb.branchId`)}
      FROM product_variations v
      JOIN products p ON p.id = v.productId
      LEFT JOIN categories cat ON cat.id = p.categoryId
      LEFT JOIN stock_balances sb ON sb.variationId = v.id AND sb.companyId = ${r.companyId} AND sb.branchId IN (${inList(r.branchIds)})
      WHERE v.companyId = ${r.companyId} AND v.status = 'active' AND p.status = 'active' ${catWhere(r)}
      GROUP BY v.id, v.sku, p.name, v.name, cat.name, p.unit, v.reorderLevel, v.salePrice`
    const having =
      status === "in"
        ? sql`WHERE t.qty > 0`
        : status === "out"
          ? sql`WHERE t.qty <= 0`
          : status === "low"
            ? sql`WHERE t.reorderLevel > 0 AND t.qty <= t.reorderLevel`
            : empty
    const [rows, [agg]] = await Promise.all([
      query<Record<string, unknown>>(sql`SELECT t.* FROM (${grouped}) t ${having} ORDER BY t.product, t.variation LIMIT ${ROW_CAP + 1}`),
      query<{ items: bigint; inStock: unknown; out: unknown; low: unknown; qty: unknown }>(
        sql`SELECT COUNT(*) AS items, SUM(t.qty > 0) AS inStock, SUM(t.qty <= 0) AS \`out\`,
            SUM(t.reorderLevel > 0 AND t.qty <= t.reorderLevel) AS low, SUM(t.qty) AS qty FROM (${grouped}) t ${having}`,
      ),
    ])
    const page = rows.slice(0, ROW_CAP)
    const ids = page.map((x) => x.id as string)
    const values = r.showCost && ids.length
      ? await query<{ variationId: string; value: unknown }>(
          sql`SELECT b.variationId, SUM(b.qtyAvailable * b.unitCost) AS value FROM inventory_batches b
            WHERE b.companyId = ${r.companyId} AND b.branchId IN (${inList(r.branchIds)}) AND b.qtyAvailable > 0
              AND b.variationId IN (${inList(ids)}) GROUP BY b.variationId`,
        )
      : []
    const valueMap = new Map(values.map((v) => [v.variationId, dec(v.value as string)]))
    const out = page.map((x) => {
      const qty = dec(x.qty as string)
      const reorder = dec(x.reorderLevel as string)
      const state = qty.lte(0) ? "Out of stock" : reorder.gt(0) && qty.lte(reorder) ? "Low — reorder" : "OK"
      const row: ReportRow = {
        sku: x.sku as string,
        product: x.product as string,
        variation: x.variation as string,
        category: (x.category as string) ?? "—",
        unit: x.unit as string,
      }
      for (const c of bcols) row[c.key] = toNum(x[c.key])
      row.qty = num(qty)
      row.reorder = num(reorder)
      row.status = state
      row.price = toNum(x.salePrice)
      row.value = num((valueMap.get(x.id as string) ?? dec(0)).toDecimalPlaces(2))
      return row
    })
    const columns: ReportColumn[] = [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "variation", label: "Variation" },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
      ...bcols.map((c) => ({ key: c.key, label: c.name, type: "qty" as const, total: true })),
      { key: "qty", label: bcols.length ? "Total qty" : "Qty", type: "qty", total: true },
      { key: "reorder", label: "Reorder level", type: "qty" },
      { key: "status", label: "Status" },
      { key: "price", label: "Sale price", type: "money" },
      { key: "value", label: "Stock value", type: "money", total: true, cost: true },
    ]
    const low = toNum(agg?.low)
    const outOfStock = toNum(agg?.out)
    return {
      summary: [
        { label: "Items", value: toNum(agg?.items), type: "int", hint: "Active variations" },
        { label: "In stock", value: toNum(agg?.inStock), type: "int" },
        { label: "Low stock", value: low, type: "int", tone: low > 0 ? "warning" : "default", hint: "At or below reorder level" },
        { label: "Out of stock", value: outOfStock, type: "int", tone: outOfStock > 0 ? "danger" : "default" },
      ],
      notes: [
        r.branchId
          ? "Reorder alerts compare the selected branch's quantity with each item's reorder level."
          : "Reorder alerts compare the total quantity across the branches in scope with each item's reorder level.",
      ],
      tables: [
        {
          key: "stock",
          columns,
          rows: out,
          totals: rows.length > ROW_CAP ? { sku: "Total", qty: toNum(agg?.qty) } : undefined,
          totalRows: rows.length > ROW_CAP ? toNum(agg?.items) : undefined,
          empty: "No items match these filters.",
        },
      ],
    }
  },
}

// ───────────── Stock movement / adjustments / transfers (INV-05) ─────────────

const TXN_LABEL: Record<string, string> = {
  opening: "Opening stock",
  purchase_in: "Purchase / LC receipt",
  sale_out: "Sale",
  return_in: "Customer return",
  cancel_in: "Invoice cancellation",
  adjustment_in: "Adjustment (in)",
  adjustment_out: "Adjustment (out)",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
}
const TXN_ORDER = Object.keys(TXN_LABEL)

const stockMovements: ReportDef = {
  slug: "stock-movements",
  title: "Stock movement & adjustments",
  description: "Stock ledger by movement type, adjustment documents and branch transfers — shown separately.",
  group: "Inventory",
  icon: ArrowLeftRight,
  perm: ["reports.stock"],
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [
    {
      key: "view",
      label: "View",
      kind: "segment",
      default: "summary",
      options: [
        { value: "summary", label: "Summary" },
        { value: "ledger", label: "Ledger" },
        { value: "adjustments", label: "Adjustments" },
        { value: "transfers", label: "Transfers" },
      ],
    },
    {
      key: "type",
      label: "Movement type",
      kind: "select",
      allLabel: "All movements",
      options: TXN_ORDER.map((k) => ({ value: k, label: TXN_LABEL[k] })),
    },
  ],
  run: async (r) => {
    const view = r.value("view")
    const type = r.value("type")
    const ledgerWhere = sql`sle.companyId = ${r.companyId} AND sle.branchId IN (${inList(r.branchIds)})
      AND sle.createdAt BETWEEN ${r.start} AND ${r.end} ${type ? sql`AND sle.type = ${type}` : empty}`

    if (view === "adjustments") return adjustments(r)
    if (view === "transfers") return transfers(r)

    if (view === "ledger") {
      const [rows, [agg]] = await Promise.all([
        query<{
          createdAt: Date
          branchId: string
          sku: string
          product: string
          variation: string
          type: string
          quantity: unknown
          balanceAfter: unknown
          unitCost: unknown
          refType: string | null
          note: string | null
        }>(sql`SELECT sle.createdAt, sle.branchId, v.sku, p.name AS product, v.name AS variation, sle.type, sle.quantity, sle.balanceAfter,
            sle.unitCost, sle.refType, sle.note
          FROM stock_ledger_entries sle JOIN product_variations v ON v.id = sle.variationId JOIN products p ON p.id = v.productId
          WHERE ${ledgerWhere} ORDER BY sle.createdAt DESC LIMIT ${ROW_CAP + 1}`),
        query<{ entries: bigint; qin: unknown; qout: unknown; value: unknown }>(
          sql`SELECT COUNT(*) AS entries, SUM(CASE WHEN sle.quantity > 0 THEN sle.quantity ELSE 0 END) AS qin,
              SUM(CASE WHEN sle.quantity < 0 THEN -sle.quantity ELSE 0 END) AS qout, SUM(sle.quantity * sle.unitCost) AS value
            FROM stock_ledger_entries sle WHERE ${ledgerWhere}`,
        ),
      ])
      const out = rows.slice(0, ROW_CAP).map((x) => {
        const q = dec(x.quantity as string)
        return {
          date: toIso(x.createdAt),
          branch: r.branchName(x.branchId),
          sku: x.sku,
          product: `${x.product} — ${x.variation}`,
          type: TXN_LABEL[x.type] ?? humanize(x.type),
          qin: q.gt(0) ? num(q) : null,
          qout: q.lt(0) ? num(q.neg()) : null,
          balance: toNum(x.balanceAfter),
          unitCost: toNum(x.unitCost),
          value: num(q.times(dec(x.unitCost as string)).toDecimalPlaces(2)),
          ref: [x.refType ? humanize(x.refType) : null, x.note].filter(Boolean).join(" · ") || "—",
        }
      })
      return {
        summary: ledgerSummary(agg),
        tables: [
          {
            key: "ledger",
            columns: [
              { key: "date", label: "Date", type: "datetime" },
              { key: "branch", label: "Branch" },
              { key: "sku", label: "SKU" },
              { key: "product", label: "Product" },
              { key: "type", label: "Movement" },
              { key: "qin", label: "In", type: "qty", total: true },
              { key: "qout", label: "Out", type: "qty", total: true },
              { key: "balance", label: "Balance", type: "qty" },
              { key: "unitCost", label: "Unit cost", type: "money", cost: true },
              { key: "value", label: "Value", type: "money", total: true, cost: true, tone: "signed" },
              { key: "ref", label: "Reference" },
            ],
            rows: out,
            totals: rows.length > ROW_CAP ? { date: "Total", qin: toNum(agg?.qin), qout: toNum(agg?.qout), value: toNum(agg?.value) } : undefined,
            totalRows: rows.length > ROW_CAP ? toNum(agg?.entries) : undefined,
            empty: "No stock movements in this period.",
          },
        ],
      }
    }

    const [rows, [agg]] = await Promise.all([
      query<{ type: string; entries: bigint; items: bigint; qin: unknown; qout: unknown; value: unknown }>(
        sql`SELECT sle.type, COUNT(*) AS entries, COUNT(DISTINCT sle.variationId) AS items,
            SUM(CASE WHEN sle.quantity > 0 THEN sle.quantity ELSE 0 END) AS qin,
            SUM(CASE WHEN sle.quantity < 0 THEN -sle.quantity ELSE 0 END) AS qout,
            SUM(sle.quantity * sle.unitCost) AS value
          FROM stock_ledger_entries sle WHERE ${ledgerWhere} GROUP BY sle.type`,
      ),
      query<{ entries: bigint; qin: unknown; qout: unknown; value: unknown }>(
        sql`SELECT COUNT(*) AS entries, SUM(CASE WHEN sle.quantity > 0 THEN sle.quantity ELSE 0 END) AS qin,
            SUM(CASE WHEN sle.quantity < 0 THEN -sle.quantity ELSE 0 END) AS qout, SUM(sle.quantity * sle.unitCost) AS value
          FROM stock_ledger_entries sle WHERE ${ledgerWhere}`,
      ),
    ])
    const byType = new Map(rows.map((x) => [x.type, x]))
    const toRow = (t: string) => {
      const x = byType.get(t)
      return {
        type: TXN_LABEL[t],
        entries: toNum(x?.entries),
        items: toNum(x?.items),
        qin: toNum(x?.qin),
        qout: toNum(x?.qout),
        value: num(dec(x?.value as string).toDecimalPlaces(2)),
      }
    }
    const columns: ReportColumn[] = [
      { key: "type", label: "Movement" },
      { key: "entries", label: "Entries", type: "int", total: true },
      { key: "items", label: "Items", type: "int" },
      { key: "qin", label: "Qty in", type: "qty", total: true },
      { key: "qout", label: "Qty out", type: "qty", total: true },
      { key: "value", label: "Net value", type: "money", total: true, cost: true, tone: "signed" },
    ]
    const groups = [
      { key: "trade", title: "Purchases, sales & returns", types: ["opening", "purchase_in", "sale_out", "return_in", "cancel_in"] },
      { key: "adjustments", title: "Adjustments", types: ["adjustment_in", "adjustment_out"] },
      { key: "transfers", title: "Branch transfers", types: ["transfer_in", "transfer_out"] },
    ]
    return {
      summary: ledgerSummary(agg),
      notes: ["Transfers move stock between branches and net to zero company-wide; they are shown separately from adjustments (INV-05)."],
      tables: groups.map((g) => ({
        key: g.key,
        title: g.title,
        columns,
        rows: g.types.filter((t) => !type || t === type).map(toRow),
        empty: "No movements.",
      })),
    }
  },
}

function ledgerSummary(agg: { entries: bigint; qin: unknown; qout: unknown; value: unknown } | undefined) {
  const net = dec(agg?.qin as string).minus(dec(agg?.qout as string))
  return [
    { label: "Movements", value: toNum(agg?.entries), type: "int" as const },
    { label: "Quantity in", value: toNum(agg?.qin), type: "qty" as const },
    { label: "Quantity out", value: toNum(agg?.qout), type: "qty" as const },
    { label: "Net change", value: num(net), type: "qty" as const, tone: net.isNegative() ? ("danger" as const) : ("default" as const) },
  ]
}

const REASON_LABEL: Record<string, string> = {
  damage: "Damage",
  count_correction: "Count correction",
  expired: "Expired",
  lost: "Lost",
  found: "Found",
  other: "Other",
}

async function adjustments(r: RunCtx) {
  const rows = await query<{
    date: Date
    number: string
    branchId: string
    reason: string
    note: string | null
    lines: bigint
    qin: unknown
    qout: unknown
    value: unknown
    by: string | null
  }>(sql`SELECT a.date, a.number, a.branchId, a.reason, a.note, COUNT(l.id) AS \`lines\`,
      SUM(CASE WHEN l.quantity > 0 THEN l.quantity ELSE 0 END) AS qin,
      SUM(CASE WHEN l.quantity < 0 THEN -l.quantity ELSE 0 END) AS qout,
      SUM(l.quantity * l.unitCost) AS value, MAX(u.name) AS \`by\`
    FROM stock_adjustments a
    LEFT JOIN stock_adjustment_lines l ON l.adjustmentId = a.id
    LEFT JOIN users u ON u.id = a.createdById
    WHERE a.companyId = ${r.companyId} AND a.branchId IN (${inList(r.branchIds)}) AND a.date BETWEEN ${r.from} AND ${r.to}
    GROUP BY a.id, a.date, a.number, a.branchId, a.reason, a.note
    ORDER BY a.date DESC, a.number DESC LIMIT ${ROW_CAP}`)
  const out = rows.map((x) => ({
    date: toYmd(x.date),
    number: x.number,
    branch: r.branchName(x.branchId),
    reason: REASON_LABEL[x.reason] ?? humanize(x.reason),
    lines: toNum(x.lines),
    qin: toNum(x.qin),
    qout: toNum(x.qout),
    value: num(dec(x.value as string).toDecimalPlaces(2)),
    by: x.by ?? "—",
    note: x.note ?? "",
  }))
  const byReason = new Map<string, { count: number; qin: number; qout: number; value: ReturnType<typeof dec> }>()
  for (const x of out) {
    const g = byReason.get(x.reason) ?? { count: 0, qin: 0, qout: 0, value: dec(0) }
    g.count++
    g.qin = num(dec(g.qin).plus(x.qin))
    g.qout = num(dec(g.qout).plus(x.qout))
    g.value = g.value.plus(x.value)
    byReason.set(x.reason, g)
  }
  const loss = out.reduce((s, x) => s.plus(x.value), dec(0))
  return {
    summary: [
      { label: "Adjustments", value: out.length, type: "int" as const },
      { label: "Quantity added", value: num(out.reduce((s, x) => s.plus(x.qin), dec(0))), type: "qty" as const },
      { label: "Quantity removed", value: num(out.reduce((s, x) => s.plus(x.qout), dec(0))), type: "qty" as const },
      { label: "Net value impact", value: num(loss), type: "money" as const, tone: loss.isNegative() ? ("danger" as const) : ("default" as const), cost: true },
    ],
    tables: [
      {
        key: "adjustments",
        title: "Adjustment documents",
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "number", label: "Number" },
          { key: "branch", label: "Branch" },
          { key: "reason", label: "Reason" },
          { key: "lines", label: "Lines", type: "int" },
          { key: "qin", label: "Qty in", type: "qty", total: true },
          { key: "qout", label: "Qty out", type: "qty", total: true },
          { key: "value", label: "Value", type: "money", total: true, cost: true, tone: "signed" },
          { key: "by", label: "By" },
          { key: "note", label: "Note" },
        ] satisfies ReportColumn[],
        rows: out,
        empty: "No stock adjustments in this period.",
      },
      {
        key: "by-reason",
        title: "By reason",
        columns: [
          { key: "reason", label: "Reason" },
          { key: "count", label: "Documents", type: "int", total: true },
          { key: "qin", label: "Qty in", type: "qty", total: true },
          { key: "qout", label: "Qty out", type: "qty", total: true },
          { key: "value", label: "Value", type: "money", total: true, cost: true, tone: "signed" },
        ] satisfies ReportColumn[],
        rows: [...byReason.entries()].map(([reason, g]) => ({ reason, count: g.count, qin: g.qin, qout: g.qout, value: num(g.value) })),
        empty: "No stock adjustments in this period.",
      },
    ],
  }
}

async function transfers(r: RunCtx) {
  const rows = await query<{
    date: Date
    number: string
    fromBranchId: string
    toBranchId: string
    status: string
    lines: bigint
    qty: unknown
    value: unknown
    receivedAt: Date | null
  }>(sql`SELECT t.date, t.number, t.fromBranchId, t.toBranchId, t.status, COUNT(l.id) AS \`lines\`, SUM(l.quantity) AS qty,
      SUM(l.quantity * l.unitCost) AS value, t.receivedAt
    FROM stock_transfers t LEFT JOIN stock_transfer_lines l ON l.transferId = t.id
    WHERE t.companyId = ${r.companyId} AND (t.fromBranchId IN (${inList(r.branchIds)}) OR t.toBranchId IN (${inList(r.branchIds)}))
      AND t.date BETWEEN ${r.from} AND ${r.to}
    GROUP BY t.id, t.date, t.number, t.fromBranchId, t.toBranchId, t.status, t.receivedAt
    ORDER BY t.date DESC, t.number DESC LIMIT ${ROW_CAP}`)
  const out = rows.map((x) => ({
    date: toYmd(x.date),
    number: x.number,
    from: r.branchName(x.fromBranchId),
    to: r.branchName(x.toBranchId),
    direction: r.branchId ? (x.fromBranchId === r.branchId ? "Outgoing" : "Incoming") : "—",
    status: humanize(x.status),
    lines: toNum(x.lines),
    qty: toNum(x.qty),
    value: num(dec(x.value as string).toDecimalPlaces(2)),
    received: toIso(x.receivedAt),
  }))
  const pending = out.filter((x) => x.status === "Pending")
  return {
    summary: [
      { label: "Transfers", value: out.length, type: "int" as const },
      { label: "Completed", value: out.filter((x) => x.status === "Completed").length, type: "int" as const },
      { label: "In transit", value: pending.length, type: "int" as const, tone: pending.length ? ("warning" as const) : ("default" as const) },
      { label: "Value moved", value: num(out.reduce((s, x) => s.plus(x.value), dec(0))), type: "money" as const, cost: true },
    ],
    tables: [
      {
        key: "transfers",
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "number", label: "Number" },
          { key: "from", label: "From" },
          { key: "to", label: "To" },
          ...(r.branchId ? [{ key: "direction", label: "Direction" }] : []),
          { key: "status", label: "Status" },
          { key: "lines", label: "Lines", type: "int" },
          { key: "qty", label: "Quantity", type: "qty", total: true },
          { key: "value", label: "Value", type: "money", total: true, cost: true },
          { key: "received", label: "Received", type: "datetime" },
        ] satisfies ReportColumn[],
        rows: out,
        empty: "No branch transfers in this period.",
      },
    ],
  }
}

export const INVENTORY_REPORTS: ReportDef[] = [inventoryValuation, stockBalance, stockMovements]
