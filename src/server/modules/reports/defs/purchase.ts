import "server-only"
import { Calculator, ShoppingCart } from "lucide-react"
import { dec, num } from "@/server/decimal"
import { money } from "@/lib/format"
import type { ReportDef, RunCtx } from "../framework"
import { datePeriodOf, empty, inList, query, ROW_CAP, sql, toIso, toNum, toYmd, type Sql } from "../sql"
import type { ReportColumn, ReportRow } from "../types"
import { computeTotals, displayDate, pct, periodKeys } from "../utils"
import { humanize } from "./common"

// ───────────── Total purchase report ─────────────

function scopes(r: RunCtx) {
  const supplier = r.value("supplierId")
  const lc = r.value("lcId")
  const b = inList(r.branchIds)
  const hasLc = r.ctx.plan.features.lc
  const hasPo = r.ctx.plan.features.purchase
  return {
    grn: sql`g.companyId = ${r.companyId} AND g.branchId IN (${b}) AND g.date BETWEEN ${r.from} AND ${r.to}
      ${supplier ? sql`AND COALESCE(po.supplierId, l.supplierId) = ${supplier}` : empty} ${lc ? sql`AND g.lcId = ${lc}` : empty}`,
    po: sql`po.companyId = ${r.companyId} AND po.branchId IN (${b}) AND po.status <> 'cancelled' AND po.orderDate BETWEEN ${r.from} AND ${r.to}
      ${supplier ? sql`AND po.supplierId = ${supplier}` : empty} ${lc ? sql`AND po.lcId = ${lc}` : empty} ${hasPo ? empty : sql`AND 1 = 0`}`,
    lc: sql`l.companyId = ${r.companyId} AND l.branchId IN (${b}) AND l.status <> 'draft'
      AND COALESCE(l.openedDate, DATE(l.createdAt)) BETWEEN ${r.from} AND ${r.to}
      ${supplier ? sql`AND l.supplierId = ${supplier}` : empty} ${lc ? sql`AND l.id = ${lc}` : empty} ${hasLc ? empty : sql`AND 1 = 0`}`,
  }
}

const GRN_FROM = sql`FROM goods_receipt_lines gl JOIN goods_receipts g ON g.id = gl.receiptId
  LEFT JOIN purchase_orders po ON po.id = g.poId LEFT JOIN lcs l ON l.id = g.lcId`

type Agg = { k: string | null; n?: bigint; v: unknown; q?: unknown }

async function byKey(r: RunCtx, grnKey: Sql, poKey: Sql, lcKey: Sql) {
  const s = scopes(r)
  const [grn, po, lc] = await Promise.all([
    query<Agg>(sql`SELECT ${grnKey} AS k, COUNT(DISTINCT g.id) AS n, SUM(gl.quantity * gl.unitCost) AS v, SUM(gl.quantity) AS q ${GRN_FROM} WHERE ${s.grn} GROUP BY 1`),
    query<Agg>(sql`SELECT ${poKey} AS k, COUNT(*) AS n, SUM(po.totalBdt) AS v FROM purchase_orders po WHERE ${s.po} GROUP BY 1`),
    query<Agg>(sql`SELECT ${lcKey} AS k, COUNT(*) AS n, SUM(l.lcValue * l.exchangeRate) AS v FROM lcs l WHERE ${s.lc} GROUP BY 1`),
  ])
  const m = (rows: Agg[]) => new Map(rows.map((x) => [x.k ?? "", x]))
  return { grn: m(grn), po: m(po), lc: m(lc), keys: [...new Set([...grn, ...po, ...lc].map((x) => x.k ?? ""))] }
}

function volumeRow(a: Awaited<ReturnType<typeof byKey>>, k: string): ReportRow {
  return {
    pos: toNum(a.po.get(k)?.n),
    poValue: toNum(a.po.get(k)?.v),
    lcs: toNum(a.lc.get(k)?.n),
    lcValue: num(dec(a.lc.get(k)?.v as string).toDecimalPlaces(2)),
    grns: toNum(a.grn.get(k)?.n),
    qty: toNum(a.grn.get(k)?.q),
    received: num(dec(a.grn.get(k)?.v as string).toDecimalPlaces(2)),
  }
}

const VOLUME_COLUMNS: ReportColumn[] = [
  { key: "pos", label: "POs", type: "int", total: true },
  { key: "poValue", label: "PO value", type: "money", total: true },
  { key: "lcs", label: "LCs", type: "int", total: true },
  { key: "lcValue", label: "LC base value", type: "money", total: true },
  { key: "grns", label: "Receipts", type: "int", total: true },
  { key: "qty", label: "Qty received", type: "qty", total: true },
  { key: "received", label: "Received at cost", type: "money", total: true },
]

function volumeSummary(t: ReportRow | null) {
  return [
    { label: "Purchase orders", value: Number(t?.poValue ?? 0), type: "money" as const, hint: `${Number(t?.pos ?? 0)} orders (BDT)` },
    { label: "LCs opened", value: Number(t?.lcValue ?? 0), type: "money" as const, hint: `${Number(t?.lcs ?? 0)} LCs · value × exchange rate` },
    { label: "Goods received", value: Number(t?.received ?? 0), type: "money" as const, hint: `${Number(t?.grns ?? 0)} goods receipts at cost` },
    { label: "Quantity received", value: Number(t?.qty ?? 0), type: "qty" as const },
  ]
}

const NOTES = [
  "PO value and LC base value are ordering commitments in the period; goods received is stock booked in at cost (landed cost for LC goods). They overlap and are not added together.",
]

const purchasesReport: ReportDef = {
  slug: "purchases",
  title: "Total purchase report",
  description: "Purchases by supplier, by LC and by date: purchase orders, LC base values and goods received at cost.",
  group: "Purchase & LC",
  icon: ShoppingCart,
  perm: ["reports.stock", "reports.financial"],
  anyFeature: ["purchase", "lc"],
  financial: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [
    {
      key: "view",
      label: "View",
      kind: "segment",
      default: "supplier",
      options: [
        { value: "supplier", label: "By supplier" },
        { value: "lc", label: "By LC" },
        { value: "period", label: "By date" },
        { value: "product", label: "By product" },
        { value: "receipts", label: "Receipts" },
      ],
    },
    { key: "supplierId", label: "Supplier", kind: "supplier" },
    { key: "lcId", label: "LC", kind: "lc" },
  ],
  run: async (r) => {
    const view = r.value("view")
    const s = scopes(r)

    if (view === "receipts" || view === "product") {
      if (view === "product") {
        const rows = await query<{ sku: string; product: string; variation: string; n: bigint; q: unknown; v: unknown }>(
          sql`SELECT MAX(v.sku) AS sku, MAX(p.name) AS product, MAX(v.name) AS variation, COUNT(DISTINCT g.id) AS n,
              SUM(gl.quantity) AS q, SUM(gl.quantity * gl.unitCost) AS v
            ${GRN_FROM} JOIN product_variations v ON v.id = gl.variationId JOIN products p ON p.id = v.productId
            WHERE ${s.grn} GROUP BY gl.variationId ORDER BY v DESC LIMIT ${ROW_CAP}`,
        )
        const out = rows.map((x) => {
          const q = dec(x.q as string)
          const v = dec(x.v as string)
          return {
            sku: x.sku,
            product: x.product,
            variation: x.variation,
            grns: toNum(x.n),
            qty: num(q),
            avg: q.isZero() ? 0 : num(v.div(q).toDecimalPlaces(2)),
            received: num(v.toDecimalPlaces(2)),
          }
        })
        const columns: ReportColumn[] = [
          { key: "sku", label: "SKU" },
          { key: "product", label: "Product" },
          { key: "variation", label: "Variation" },
          { key: "grns", label: "Receipts", type: "int" },
          { key: "qty", label: "Qty received", type: "qty", total: true },
          { key: "avg", label: "Avg unit cost", type: "money" },
          { key: "received", label: "Received at cost", type: "money", total: true },
        ]
        const t = computeTotals(columns, out)
        return {
          summary: [
            { label: "Products received", value: out.length, type: "int" },
            { label: "Quantity received", value: Number(t?.qty ?? 0), type: "qty" },
            { label: "Received at cost", value: Number(t?.received ?? 0), type: "money" },
          ],
          tables: [{ key: "by-product", columns, rows: out, totals: t, empty: "No goods received in this period." }],
        }
      }
      const rows = await query<{ date: Date; number: string; branchId: string; po: string | null; lc: string | null; supplier: string | null; lines: bigint; q: unknown; v: unknown }>(
        sql`SELECT g.date, g.number, g.branchId, MAX(po.number) AS po, MAX(l.lcNumber) AS lc, MAX(sp.name) AS supplier,
            COUNT(gl.id) AS \`lines\`, SUM(gl.quantity) AS q, SUM(gl.quantity * gl.unitCost) AS v
          ${GRN_FROM} LEFT JOIN suppliers sp ON sp.id = COALESCE(po.supplierId, l.supplierId)
          WHERE ${s.grn} GROUP BY g.id, g.date, g.number, g.branchId ORDER BY g.date DESC, g.number DESC LIMIT ${ROW_CAP}`,
      )
      const out = rows.map((x) => ({
        date: toYmd(x.date),
        number: x.number,
        branch: r.branchName(x.branchId),
        source: x.lc ? `LC ${x.lc}` : x.po ? `PO ${x.po}` : "Direct",
        supplier: x.supplier ?? "—",
        lines: toNum(x.lines),
        qty: toNum(x.q),
        received: num(dec(x.v as string).toDecimalPlaces(2)),
      }))
      const columns: ReportColumn[] = [
        { key: "date", label: "Date", type: "date" },
        { key: "number", label: "Receipt" },
        { key: "branch", label: "Branch" },
        { key: "source", label: "Against" },
        { key: "supplier", label: "Supplier" },
        { key: "lines", label: "Lines", type: "int" },
        { key: "qty", label: "Quantity", type: "qty", total: true },
        { key: "received", label: "Value at cost", type: "money", total: true },
      ]
      const t = computeTotals(columns, out)
      return {
        summary: [
          { label: "Goods receipts", value: out.length, type: "int" },
          { label: "Quantity received", value: Number(t?.qty ?? 0), type: "qty" },
          { label: "Received at cost", value: Number(t?.received ?? 0), type: "money" },
        ],
        tables: [{ key: "receipts", columns, rows: out, totals: t, empty: "No goods received in this period." }],
      }
    }

    if (view === "period") {
      const period = r.from.slice(0, 7) === r.to.slice(0, 7) ? "day" : "month"
      const a = await byKey(r, datePeriodOf("g.date", period), datePeriodOf("po.orderDate", period), sql`DATE_FORMAT(COALESCE(l.openedDate, DATE(l.createdAt)), ${period === "day" ? "%Y-%m-%d" : "%Y-%m"})`)
      const rows = periodKeys(r.from, r.to, period).map((k) => ({ period: period === "day" ? k : displayDate(k), ...volumeRow(a, k) }))
      const columns: ReportColumn[] = [{ key: "period", label: period === "day" ? "Date" : "Month", type: period === "day" ? "date" : "text" }, ...VOLUME_COLUMNS]
      const t = computeTotals(columns, rows)
      return {
        summary: volumeSummary(t),
        chart: {
          kind: "bar",
          xKey: "label",
          series: [
            { key: "poValue", label: "PO value" },
            { key: "lcValue", label: "LC base value" },
            { key: "received", label: "Received" },
          ],
          data: rows.map((x) => ({ ...x, label: period === "day" ? displayDate(String(x.period)).slice(0, 6) : x.period })),
          valueType: "money",
        },
        tables: [{ key: "by-period", columns, rows, totals: t }],
        notes: NOTES,
      }
    }

    if (view === "lc") {
      const rows = await query<{ id: string; lcNumber: string; supplier: string; status: string; opened: Date | null; currency: string; lcValue: unknown; rate: unknown; extra: unknown }>(
        sql`SELECT l.id, l.lcNumber, sp.name AS supplier, l.status, COALESCE(l.openedDate, DATE(l.createdAt)) AS opened, l.currency, l.lcValue,
            l.exchangeRate AS rate, (SELECT SUM(ci.amount) FROM lc_cost_items ci WHERE ci.lcId = l.id AND ci.companyId = ${r.companyId}) AS extra
          FROM lcs l JOIN suppliers sp ON sp.id = l.supplierId WHERE ${s.lc} ORDER BY opened DESC LIMIT ${ROW_CAP}`,
      )
      const ids = rows.map((x) => x.id)
      const recv = ids.length
        ? await query<{ k: string; q: unknown; v: unknown }>(
            sql`SELECT g.lcId AS k, SUM(gl.quantity) AS q, SUM(gl.quantity * gl.unitCost) AS v FROM goods_receipt_lines gl JOIN goods_receipts g ON g.id = gl.receiptId
              WHERE g.companyId = ${r.companyId} AND g.lcId IN (${inList(ids)}) GROUP BY g.lcId`,
          )
        : []
      const rm = new Map(recv.map((x) => [x.k, x]))
      const out = rows.map((x) => {
        const base = dec(x.lcValue as string).times(dec(x.rate as string)).toDecimalPlaces(2)
        const extra = dec(x.extra as string)
        return {
          lc: x.lcNumber,
          supplier: x.supplier,
          status: humanize(x.status),
          opened: toYmd(x.opened),
          currency: x.currency,
          foreign: toNum(x.lcValue),
          rate: toNum(x.rate),
          base: num(base),
          extra: num(extra),
          landed: num(base.plus(extra)),
          qty: toNum(rm.get(x.id)?.q),
          received: num(dec(rm.get(x.id)?.v as string).toDecimalPlaces(2)),
        }
      })
      const columns: ReportColumn[] = [
        { key: "lc", label: "LC" },
        { key: "supplier", label: "Supplier" },
        { key: "status", label: "Status" },
        { key: "opened", label: "Opened", type: "date" },
        { key: "currency", label: "Cur." },
        { key: "foreign", label: "LC value (FC)", type: "money" },
        { key: "rate", label: "Rate", type: "qty" },
        { key: "base", label: "Base (BDT)", type: "money", total: true },
        { key: "extra", label: "Extra costs", type: "money", total: true },
        { key: "landed", label: "Landed total", type: "money", total: true },
        { key: "qty", label: "Qty received", type: "qty", total: true },
        { key: "received", label: "Received at cost", type: "money", total: true },
      ]
      const t = computeTotals(columns, out)
      return {
        summary: [
          { label: "LCs", value: out.length, type: "int" },
          { label: "Base value", value: Number(t?.base ?? 0), type: "money", hint: "LC value × exchange rate" },
          { label: "Extra costs", value: Number(t?.extra ?? 0), type: "money", hint: `${pct(Number(t?.extra ?? 0), Number(t?.base ?? 0))}% of base` },
          { label: "Received at cost", value: Number(t?.received ?? 0), type: "money" },
        ],
        tables: [{ key: "by-lc", columns, rows: out, totals: t, empty: "No LCs opened in this period." }],
        notes: ["LCs are listed by opening date. Received columns include all receipts against the LC to date."],
      }
    }

    // by supplier
    const a = await byKey(r, sql`COALESCE(po.supplierId, l.supplierId)`, sql`po.supplierId`, sql`l.supplierId`)
    const names = a.keys.length
      ? await r.db.supplier.findMany({ where: { id: { in: a.keys.filter(Boolean) } }, select: { id: true, name: true, code: true } })
      : []
    const nm = new Map(names.map((x) => [x.id, x]))
    const rows = a.keys
      .map((k): ReportRow => ({ code: nm.get(k)?.code ?? "—", supplier: nm.get(k)?.name ?? "Direct / no supplier", ...volumeRow(a, k) }))
      .sort((x, y) => Number(y.received) + Number(y.lcValue) + Number(y.poValue) - (Number(x.received) + Number(x.lcValue) + Number(x.poValue)))
    const columns: ReportColumn[] = [{ key: "code", label: "Code" }, { key: "supplier", label: "Supplier" }, ...VOLUME_COLUMNS]
    const t = computeTotals(columns, rows)
    return {
      summary: volumeSummary(t),
      chart: rows.length > 1 ? { kind: "hbar", xKey: "supplier", series: [{ key: "received", label: "Received at cost" }], data: rows.slice(0, 10), valueType: "money" } : null,
      tables: [{ key: "by-supplier", columns, rows, totals: t, empty: "No purchases in this period." }],
      notes: NOTES,
    }
  },
}

// ───────────── LC cost & landed cost ─────────────

const COST_LABEL: Record<string, string> = {
  lc_opening: "LC opening",
  freight: "Freight",
  port: "Port charges",
  cnf: "C&F agent",
  transport: "Transport",
  unloading: "Unloading",
  delivery: "Delivery",
  staff_salary: "Staff salary",
  entertainment: "Entertainment",
  customs_duty: "Customs duty",
  other: "Other",
}

async function lcDetail(r: RunCtx, lcId: string) {
  const lc = await r.db.lc.findFirst({
    where: { id: lcId, branchId: { in: r.branchIds } },
    include: {
      supplier: { select: { name: true } },
      costItems: { orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }] },
      lines: true,
      snapshots: { where: { isCurrent: true }, include: { lines: true }, take: 1 },
    },
  })
  if (!lc) return { tables: [], prompt: { title: "LC not found", text: "This LC does not exist or is outside your branches." } }
  const snap = lc.snapshots[0]
  const varIds = [...new Set([...lc.lines.map((l) => l.variationId), ...(snap?.lines.map((l) => l.variationId) ?? [])])]
  const vars = varIds.length
    ? await r.db.productVariation.findMany({ where: { id: { in: varIds } }, select: { id: true, sku: true, name: true, product: { select: { name: true, unit: true } } } })
    : []
  const vm = new Map(vars.map((v) => [v.id, v]))
  const rate = dec(snap?.exchangeRate ?? lc.exchangeRate)
  const base = snap ? dec(snap.totalBaseCost) : dec(lc.lcValue).times(rate).toDecimalPlaces(2)
  const itemsTotal = lc.costItems.reduce((s, c) => s.plus(c.amount), dec(0))
  const extra = snap ? dec(snap.totalExtraCost) : itemsTotal
  const drift = snap && !itemsTotal.eq(extra)
  const costRows: ReportRow[] = lc.costItems.map((c) => ({
    date: c.entryDate.toISOString().slice(0, 10),
    type: COST_LABEL[c.costType] ?? humanize(c.costType),
    description: c.description ?? "—",
    source: c.sourceType === "delivery_charge" ? "Delivery charge" : c.sourceType === "expense" ? "Expense" : "Manual",
    amount: num(c.amount),
    share: pct(dec(c.amount), itemsTotal),
  }))
  const lineRows: ReportRow[] = snap
    ? snap.lines.map((l) => {
        const v = vm.get(l.variationId)
        return {
          sku: v?.sku ?? "—",
          product: v ? `${v.product.name} — ${v.name}` : "—",
          qty: num(l.quantity),
          weight: num(dec(l.unitWeight).times(l.quantity).toDecimalPlaces(3)),
          ratio: num(dec(l.ratio).times(100).toDecimalPlaces(2)),
          baseUnit: num(l.baseUnitCost),
          extraTotal: num(l.extraCostTotal),
          extraUnit: num(l.extraUnitCost),
          landedUnit: num(l.landedUnitCost),
          landedTotal: num(dec(l.landedUnitCost).times(l.quantity).toDecimalPlaces(2)),
        }
      })
    : lc.lines.map((l) => {
        const v = vm.get(l.variationId)
        const baseUnit = dec(l.unitPriceForeign).times(rate).toDecimalPlaces(4)
        return {
          sku: v?.sku ?? "—",
          product: v ? `${v.product.name} — ${v.name}` : "—",
          qty: num(l.quantity),
          weight: num(dec(l.unitWeight).times(l.quantity).toDecimalPlaces(3)),
          ratio: null,
          baseUnit: num(baseUnit),
          extraTotal: null,
          extraUnit: null,
          landedUnit: null,
          landedTotal: num(baseUnit.times(l.quantity).toDecimalPlaces(2)),
        }
      })
  const basisLabel = (snap?.basis ?? lc.distributionBasis) === "weight" ? "Weight" : "Quantity"
  return {
    summary: [
      { label: "LC value", value: money(num(lc.lcValue), lc.currency), hint: `Rate ${num(rate)} · ${lc.supplier.name}` },
      { label: "Base cost (BDT)", value: num(base), type: "money" as const },
      { label: "Extra costs", value: num(extra), type: "money" as const, hint: drift ? "Per snapshot — cost items changed since" : `${lc.costItems.length} items · ${pct(extra, base)}% of base`, tone: drift ? ("warning" as const) : undefined },
      {
        label: "Landed total",
        value: num(base.plus(extra)),
        type: "money" as const,
        hint: snap ? `Snapshot v${snap.version} · ${basisLabel} basis` : "Not finalized yet",
        tone: snap ? ("success" as const) : ("warning" as const),
      },
    ],
    tables: [
      {
        key: "cost-items",
        title: "Cost items",
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "type", label: "Cost type" },
          { key: "description", label: "Description" },
          { key: "source", label: "Source" },
          { key: "amount", label: "Amount", type: "money", total: true },
          { key: "share", label: "Share", type: "percent", total: true },
        ] satisfies ReportColumn[],
        rows: costRows,
        empty: "No cost items recorded on this LC.",
      },
      {
        key: "landed",
        title: snap ? `Landed cost per line (current snapshot v${snap.version}, ${basisLabel.toLowerCase()} basis)` : "LC lines at base cost (landed cost not finalized)",
        columns: [
          { key: "sku", label: "SKU" },
          { key: "product", label: "Product" },
          { key: "qty", label: "Qty", type: "qty", total: true },
          { key: "weight", label: "Total weight", type: "qty", total: true },
          { key: "ratio", label: "Share of extra", type: "percent", total: true },
          { key: "baseUnit", label: "Base unit cost", type: "money" },
          { key: "extraTotal", label: "Extra cost", type: "money", total: true },
          { key: "extraUnit", label: "Extra / unit", type: "money" },
          { key: "landedUnit", label: "Landed unit cost", type: "money" },
          { key: "landedTotal", label: "Landed total", type: "money", total: true },
        ] satisfies ReportColumn[],
        rows: lineRows,
        empty: "This LC has no product lines.",
      },
    ],
    notes: [
      `${lc.lcNumber} · ${humanize(lc.status)} · ${lc.issuingBank}${lc.finalizedAt ? ` · finalized ${lc.finalizedAt.toISOString().slice(0, 10)}` : ""}`,
      "Landed unit cost = base unit cost (foreign price × exchange rate) + share of extra costs by the distribution basis (LC-04).",
      ...(drift
        ? [`Cost items now total ${money(num(itemsTotal))} but the finalized snapshot used ${money(num(extra))} — re-finalize the LC to include the change.`]
        : []),
    ],
  }
}

const lcCosts: ReportDef = {
  slug: "lc-costs",
  title: "LC cost & landed cost",
  description: "Per LC: cost items, distribution basis and landed cost per line from the current snapshot.",
  group: "Purchase & LC",
  icon: Calculator,
  perm: ["reports.financial", "reports.stock"],
  features: ["lc"],
  financial: true,
  date: "range",
  defaultRange: "this_year",
  landscape: true,
  filters: [
    { key: "lcId", label: "LC", kind: "lc" },
    {
      key: "status",
      label: "Status",
      kind: "select",
      allLabel: "Any status",
      options: ["opened", "goods_in_transit", "received", "cost_finalized", "closed", "draft"].map((s) => ({ value: s, label: humanize(s) })),
    },
  ],
  run: async (r) => {
    const lcId = r.value("lcId")
    if (lcId) return lcDetail(r, lcId)
    const status = r.value("status")
    const rows = await query<{
      id: string
      lcNumber: string
      supplier: string
      status: string
      opened: Date | null
      currency: string
      lcValue: unknown
      rate: unknown
      basis: string
      extra: unknown
      snapBase: unknown
      version: number | null
      finalizedAt: Date | null
    }>(sql`SELECT l.id, l.lcNumber, sp.name AS supplier, l.status, COALESCE(l.openedDate, DATE(l.createdAt)) AS opened, l.currency, l.lcValue,
        l.exchangeRate AS rate, l.distributionBasis AS basis,
        (SELECT SUM(ci.amount) FROM lc_cost_items ci WHERE ci.lcId = l.id AND ci.companyId = ${r.companyId}) AS extra,
        s.totalBaseCost AS snapBase, s.version, l.finalizedAt
      FROM lcs l JOIN suppliers sp ON sp.id = l.supplierId
      LEFT JOIN landed_cost_snapshots s ON s.lcId = l.id AND s.isCurrent = 1 AND s.companyId = ${r.companyId}
      WHERE l.companyId = ${r.companyId} AND l.branchId IN (${inList(r.branchIds)})
        AND COALESCE(l.openedDate, DATE(l.createdAt)) BETWEEN ${r.from} AND ${r.to} ${status ? sql`AND l.status = ${status}` : empty}
      ORDER BY opened DESC LIMIT ${ROW_CAP}`)
    const out = rows.map((x) => {
      const base = x.snapBase != null ? dec(x.snapBase as string) : dec(x.lcValue as string).times(dec(x.rate as string)).toDecimalPlaces(2)
      const extra = dec(x.extra as string)
      return {
        lc: x.lcNumber,
        supplier: x.supplier,
        status: humanize(x.status),
        opened: toYmd(x.opened),
        currency: x.currency,
        foreign: toNum(x.lcValue),
        rate: toNum(x.rate),
        basis: humanize(x.basis),
        base: num(base),
        extra: num(extra),
        extraPct: pct(extra, base),
        landed: num(base.plus(extra)),
        snapshot: x.version ? `v${x.version}` : "—",
        finalized: toIso(x.finalizedAt),
      }
    })
    const columns: ReportColumn[] = [
      { key: "lc", label: "LC" },
      { key: "supplier", label: "Supplier" },
      { key: "status", label: "Status" },
      { key: "opened", label: "Opened", type: "date" },
      { key: "currency", label: "Cur." },
      { key: "foreign", label: "LC value (FC)", type: "money" },
      { key: "rate", label: "Rate", type: "qty" },
      { key: "basis", label: "Basis" },
      { key: "base", label: "Base (BDT)", type: "money", total: true },
      { key: "extra", label: "Extra costs", type: "money", total: true },
      { key: "extraPct", label: "Extra %", type: "percent" },
      { key: "landed", label: "Landed total", type: "money", total: true },
      { key: "snapshot", label: "Snapshot" },
      { key: "finalized", label: "Finalized", type: "datetime" },
    ]
    const t = computeTotals(columns, out)
    if (t) t.extraPct = pct(Number(t.extra ?? 0), Number(t.base ?? 0))
    return {
      summary: [
        { label: "LCs", value: out.length, type: "int", hint: `${out.filter((x) => x.snapshot !== "—").length} finalized` },
        { label: "Base value", value: Number(t?.base ?? 0), type: "money" },
        { label: "Extra costs", value: Number(t?.extra ?? 0), type: "money", hint: `${t?.extraPct ?? 0}% of base` },
        { label: "Landed total", value: Number(t?.landed ?? 0), type: "money" },
      ],
      chart: out.length > 1 ? { kind: "hbar", xKey: "lc", series: [{ key: "base", label: "Base" }, { key: "extra", label: "Extra costs" }], data: out.slice(0, 12), valueType: "money" } : null,
      tables: [{ key: "lcs", columns, rows: out, totals: t, empty: "No LCs opened in this period." }],
      notes: ["Choose an LC in the filter for its cost items and per-line landed cost."],
    }
  },
}

export const PURCHASE_REPORTS: ReportDef[] = [purchasesReport, lcCosts]
