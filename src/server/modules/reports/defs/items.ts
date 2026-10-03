import "server-only"
import { Award, Undo2, UserRoundSearch } from "lucide-react"
import { dec, num } from "@/server/decimal"
import { ownSalesSql, type ReportDef, type RunCtx } from "../framework"
import { empty, inList, query, ROW_CAP, sql, toIso, toNum, type Sql } from "../sql"
import type { ReportColumn, ReportRow } from "../types"
import { computeTotals, pct } from "../utils"
import { categoryFilter, humanize, invoiceScope } from "./common"

const ITEM_JOIN = sql`FROM invoice_lines il
  JOIN invoices i ON i.id = il.invoiceId
  JOIN product_variations v ON v.id = il.variationId
  JOIN products p ON p.id = v.productId`

function itemWhere(r: RunCtx): Sql {
  const cat = r.value("categoryId")
  const customer = r.value("customerId")
  return sql`${invoiceScope(r)} ${cat ? sql`AND p.categoryId = ${cat}` : empty} ${customer ? sql`AND i.customerId = ${customer}` : empty}`
}

// ───────────── Top selling items ─────────────

const topItems: ReportDef = {
  slug: "top-items",
  title: "Top selling items",
  description: "Best-selling products and variations by quantity or revenue, filterable by customer.",
  group: "Sales",
  icon: Award,
  perm: ["reports.sales"],
  salesScoped: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [
    {
      key: "rank",
      label: "Rank by",
      kind: "segment",
      default: "revenue",
      options: [
        { value: "revenue", label: "Revenue" },
        { value: "qty", label: "Quantity" },
      ],
    },
    {
      key: "top",
      label: "Show",
      kind: "segment",
      default: "25",
      options: [
        { value: "10", label: "Top 10" },
        { value: "25", label: "Top 25" },
        { value: "50", label: "Top 50" },
        { value: "100", label: "Top 100" },
      ],
    },
    { key: "customerId", label: "Customer", kind: "customer" },
    categoryFilter,
  ],
  run: async (r) => {
    const top = Number(r.value("top") ?? 25)
    const byQty = r.value("rank") === "qty"
    const rows = await query<{
      variationId: string
      sku: string
      product: string
      variation: string
      unit: string
      qty: unknown
      retQty: unknown
      revenue: unknown
      cost: unknown
      invoices: bigint
      customers: bigint
    }>(sql`SELECT il.variationId, MAX(v.sku) AS sku, MAX(p.name) AS product, MAX(v.name) AS variation, MAX(p.unit) AS unit,
        SUM(il.quantity - il.returnedQty) AS qty, SUM(il.returnedQty) AS retQty,
        SUM(CASE WHEN il.quantity > 0 THEN il.lineTotal * (il.quantity - il.returnedQty) / il.quantity ELSE 0 END) AS revenue,
        SUM((il.quantity - il.returnedQty) * il.unitCost) AS cost,
        COUNT(DISTINCT i.id) AS invoices, COUNT(DISTINCT i.customerId) AS customers
      ${ITEM_JOIN}
      WHERE ${itemWhere(r)}
      GROUP BY il.variationId
      ORDER BY ${byQty ? sql`qty` : sql`revenue`} DESC
      LIMIT ${top}`)
    const [all] = await query<{ qty: unknown; revenue: unknown; items: bigint }>(
      sql`SELECT SUM(il.quantity - il.returnedQty) AS qty,
          SUM(CASE WHEN il.quantity > 0 THEN il.lineTotal * (il.quantity - il.returnedQty) / il.quantity ELSE 0 END) AS revenue,
          COUNT(DISTINCT il.variationId) AS items
        ${ITEM_JOIN} WHERE ${itemWhere(r)}`,
    )
    const totalRevenue = dec(all?.revenue as string)
    const totalQty = dec(all?.qty as string)
    const out: ReportRow[] = rows.map((x, idx) => {
      const revenue = dec(x.revenue as string).toDecimalPlaces(2)
      const qty = dec(x.qty as string)
      const profit = revenue.minus(dec(x.cost as string))
      return {
        rank: idx + 1,
        sku: x.sku,
        product: x.product,
        variation: x.variation,
        qty: num(qty),
        unit: x.unit,
        retQty: toNum(x.retQty),
        revenue: num(revenue),
        avgPrice: qty.isZero() ? 0 : num(revenue.div(qty).toDecimalPlaces(2)),
        invoices: toNum(x.invoices),
        customers: toNum(x.customers),
        profit: num(profit.toDecimalPlaces(2)),
        margin: pct(profit, revenue),
        share: byQty ? pct(qty, totalQty) : pct(revenue, totalRevenue),
      }
    })
    const columns: ReportColumn[] = [
      { key: "rank", label: "#", type: "int" },
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "variation", label: "Variation" },
      { key: "qty", label: "Net qty", type: "qty", total: true },
      { key: "unit", label: "Unit" },
      { key: "retQty", label: "Returned", type: "qty", total: true },
      { key: "revenue", label: "Revenue", type: "money", total: true },
      { key: "avgPrice", label: "Avg price", type: "money" },
      { key: "invoices", label: "Invoices", type: "int" },
      { key: "customers", label: "Customers", type: "int" },
      { key: "profit", label: "Profit", type: "money", total: true, cost: true, tone: "signed" },
      { key: "margin", label: "Margin", type: "percent", cost: true },
      { key: "share", label: byQty ? "Share of qty" : "Share of revenue", type: "percent", total: true },
    ]
    const totals = computeTotals(columns, out)
    if (totals) {
      totals.sku = `Top ${out.length}`
      totals.share = byQty ? pct(Number(totals.qty ?? 0), totalQty) : pct(Number(totals.revenue ?? 0), totalRevenue)
    }
    return {
      summary: [
        { label: "Items sold", value: toNum(all?.items), type: "int", hint: "Distinct variations in period" },
        { label: "Total net quantity", value: num(totalQty), type: "qty" },
        { label: "Total revenue", value: num(totalRevenue.toDecimalPlaces(2)), type: "money" },
        { label: `Top ${out.length} share`, value: Number(totals?.share ?? 0), type: "percent", hint: byQty ? "of quantity" : "of revenue" },
      ],
      chart: out.length
        ? {
            kind: "hbar",
            xKey: "label",
            series: [{ key: byQty ? "qty" : "revenue", label: byQty ? "Net qty" : "Revenue" }],
            data: out.slice(0, 10).map((x) => ({ label: `${x.product} — ${x.variation}`, qty: x.qty, revenue: x.revenue })),
            valueType: byQty ? "qty" : "money",
          }
        : null,
      tables: [{ key: "items", columns, rows: out, totals, empty: "No items sold in this period." }],
      notes: ["Quantities and revenue are net of returned quantities. Revenue is line value before invoice-level discounts."],
    }
  },
}

// ───────────── Customer product-wise ─────────────

const customerProducts: ReportDef = {
  slug: "customer-products",
  title: "Customer product-wise",
  description: "What each customer purchased: products, quantities, value and last purchase date.",
  group: "Customers & suppliers",
  icon: UserRoundSearch,
  perm: ["reports.sales"],
  salesScoped: true,
  date: "range",
  defaultRange: "this_year",
  landscape: true,
  filters: [{ key: "customerId", label: "Customer", kind: "customer" }, categoryFilter],
  run: async (r) => {
    const rows = await query<{
      customer: string
      phone: string | null
      sku: string
      product: string
      variation: string
      invoices: bigint
      qty: unknown
      retQty: unknown
      revenue: unknown
      cost: unknown
      last: Date
    }>(sql`SELECT COALESCE(c.name, 'Walk-in customers') AS customer, MAX(c.phone) AS phone,
        MAX(v.sku) AS sku, MAX(p.name) AS product, MAX(v.name) AS variation,
        COUNT(DISTINCT i.id) AS invoices, SUM(il.quantity) AS qty, SUM(il.returnedQty) AS retQty,
        SUM(CASE WHEN il.quantity > 0 THEN il.lineTotal * (il.quantity - il.returnedQty) / il.quantity ELSE 0 END) AS revenue,
        SUM((il.quantity - il.returnedQty) * il.unitCost) AS cost,
        MAX(i.invoiceDate) AS last
      ${ITEM_JOIN}
      LEFT JOIN customers c ON c.id = i.customerId
      WHERE ${itemWhere(r)}
      GROUP BY i.customerId, il.variationId, c.name
      ORDER BY (i.customerId IS NULL), customer, revenue DESC
      LIMIT ${ROW_CAP + 1}`)
    const [agg] = await query<{ customers: bigint; items: bigint; qty: unknown; retQty: unknown; revenue: unknown; cost: unknown; groups: bigint }>(
      sql`SELECT COUNT(DISTINCT i.customerId) AS customers, COUNT(DISTINCT il.variationId) AS items,
          SUM(il.quantity) AS qty, SUM(il.returnedQty) AS retQty,
          SUM(CASE WHEN il.quantity > 0 THEN il.lineTotal * (il.quantity - il.returnedQty) / il.quantity ELSE 0 END) AS revenue,
          SUM((il.quantity - il.returnedQty) * il.unitCost) AS cost,
          COUNT(DISTINCT CONCAT(COALESCE(i.customerId, '-'), ':', il.variationId)) AS \`groups\`
        ${ITEM_JOIN} WHERE ${itemWhere(r)}`,
    )
    const out = rows.slice(0, ROW_CAP).map((x) => {
      const revenue = dec(x.revenue as string).toDecimalPlaces(2)
      return {
        customer: x.customer,
        phone: x.phone ?? "—",
        sku: x.sku,
        product: `${x.product} — ${x.variation}`,
        invoices: toNum(x.invoices),
        qty: toNum(x.qty),
        retQty: toNum(x.retQty),
        revenue: num(revenue),
        profit: num(revenue.minus(dec(x.cost as string)).toDecimalPlaces(2)),
        last: toIso(x.last),
      }
    })
    const revenue = dec(agg?.revenue as string).toDecimalPlaces(2)
    const columns: ReportColumn[] = [
      { key: "customer", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "invoices", label: "Invoices", type: "int" },
      { key: "qty", label: "Qty bought", type: "qty", total: true },
      { key: "retQty", label: "Returned", type: "qty", total: true },
      { key: "revenue", label: "Net value", type: "money", total: true },
      { key: "profit", label: "Profit", type: "money", total: true, cost: true, tone: "signed" },
      { key: "last", label: "Last purchased", type: "datetime" },
    ]
    return {
      summary: [
        { label: "Customers", value: toNum(agg?.customers), type: "int", hint: "Excluding walk-in" },
        { label: "Products", value: toNum(agg?.items), type: "int" },
        { label: "Net value", value: num(revenue), type: "money" },
        { label: "Profit", value: num(revenue.minus(dec(agg?.cost as string)).toDecimalPlaces(2)), type: "money", cost: true },
      ],
      tables: [
        {
          key: "customer-products",
          columns,
          rows: out,
          totals: {
            customer: "Total",
            qty: toNum(agg?.qty),
            retQty: toNum(agg?.retQty),
            revenue: num(revenue),
            profit: num(revenue.minus(dec(agg?.cost as string)).toDecimalPlaces(2)),
          },
          totalRows: rows.length > ROW_CAP ? toNum(agg?.groups) : undefined,
          empty: "No purchases in this period.",
        },
      ],
    }
  },
}

// ───────────── Total return report ─────────────

const RETURN_VIEWS = [
  { value: "list", label: "Returns" },
  { value: "product", label: "By product" },
  { value: "customer", label: "By customer" },
  { value: "reason", label: "By reason" },
]

function returnWhere(r: RunCtx): Sql {
  const status = r.value("status")
  const customer = r.value("customerId")
  return sql`sr.companyId = ${r.companyId} AND sr.branchId IN (${inList(r.branchIds)})
    AND sr.date BETWEEN ${r.start} AND ${r.end}
    ${status ? sql`AND sr.status = ${status}` : empty}
    ${customer ? sql`AND sr.customerId = ${customer}` : empty}
    ${ownSalesSql(r, "i")}`
}

const returnsReport: ReportDef = {
  slug: "returns",
  title: "Total return report",
  description: "Sales returns by product, customer and reason, with refund mode and approval status.",
  group: "Sales",
  icon: Undo2,
  perm: ["reports.sales"],
  salesScoped: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [
    { key: "view", label: "View", kind: "segment", options: RETURN_VIEWS, default: "list" },
    {
      key: "status",
      label: "Status",
      kind: "select",
      default: "approved",
      allLabel: "Any status",
      options: [
        { value: "approved", label: "Approved" },
        { value: "pending", label: "Pending" },
        { value: "rejected", label: "Rejected" },
      ],
    },
    { key: "customerId", label: "Customer", kind: "customer" },
  ],
  run: async (r) => {
    const view = r.value("view")
    const from = sql`FROM sales_returns sr JOIN invoices i ON i.id = sr.invoiceId LEFT JOIN customers c ON c.id = sr.customerId`
    const [agg] = await query<{ returns: bigint; amount: unknown; cost: unknown; approved: unknown; pending: unknown }>(
      sql`SELECT COUNT(*) AS returns, SUM(sr.totalAmount) AS amount, SUM(sr.costAmount) AS cost,
          SUM(sr.status = 'approved') AS approved, SUM(sr.status = 'pending') AS pending
        ${from} WHERE ${returnWhere(r)}`,
    )
    const [sales] = await query<{ net: unknown }>(sql`SELECT SUM(i.total) AS net FROM invoices i WHERE ${invoiceScope(r)}`)
    const amount = dec(agg?.amount as string)
    const summary = [
      { label: "Returns", value: toNum(agg?.returns), type: "int" as const, hint: `${toNum(agg?.approved)} approved · ${toNum(agg?.pending)} pending` },
      { label: "Return value", value: num(amount), type: "money" as const },
      { label: "Return rate", value: pct(amount, dec(sales?.net as string)), type: "percent" as const, hint: "of net sales in the period" },
      { label: "Cost restocked", value: toNum(agg?.cost), type: "money" as const, cost: true },
    ]

    if (view === "product") {
      const rows = await query<{ sku: string; product: string; variation: string; returns: bigint; qty: unknown; amount: unknown; cost: unknown }>(
        sql`SELECT MAX(v.sku) AS sku, MAX(p.name) AS product, MAX(v.name) AS variation, COUNT(DISTINCT sr.id) AS returns,
            SUM(rl.quantity) AS qty, SUM(rl.amount) AS amount, SUM(rl.quantity * rl.unitCost) AS cost
          FROM sales_return_lines rl JOIN sales_returns sr ON sr.id = rl.returnId JOIN invoices i ON i.id = sr.invoiceId
          JOIN product_variations v ON v.id = rl.variationId JOIN products p ON p.id = v.productId
          WHERE ${returnWhere(r)} GROUP BY rl.variationId ORDER BY amount DESC LIMIT ${ROW_CAP}`,
      )
      const out = rows.map((x) => ({
        sku: x.sku,
        product: x.product,
        variation: x.variation,
        returns: toNum(x.returns),
        qty: toNum(x.qty),
        amount: toNum(x.amount),
        cost: num(dec(x.cost as string).toDecimalPlaces(2)),
        share: pct(dec(x.amount as string), amount),
      }))
      return {
        summary,
        chart: out.length > 1 ? { kind: "hbar", xKey: "product", series: [{ key: "amount", label: "Return value" }], data: out.slice(0, 10), valueType: "money" } : null,
        tables: [
          {
            key: "by-product",
            columns: [
              { key: "sku", label: "SKU" },
              { key: "product", label: "Product" },
              { key: "variation", label: "Variation" },
              { key: "returns", label: "Returns", type: "int" },
              { key: "qty", label: "Qty returned", type: "qty", total: true },
              { key: "amount", label: "Value", type: "money", total: true },
              { key: "cost", label: "Cost", type: "money", total: true, cost: true },
              { key: "share", label: "Share", type: "percent", total: true },
            ],
            rows: out,
            empty: "No returns in this period.",
          },
        ],
      }
    }

    if (view === "customer" || view === "reason") {
      const key = view === "customer" ? sql`COALESCE(c.name, i.customerName, 'Walk-in customer')` : sql`COALESCE(NULLIF(TRIM(sr.reason), ''), '(No reason given)')`
      const rows = await query<{ k: string; returns: bigint; amount: unknown; cost: unknown; cash: unknown; credit: unknown }>(
        sql`SELECT ${key} AS k, COUNT(*) AS returns, SUM(sr.totalAmount) AS amount, SUM(sr.costAmount) AS cost,
            SUM(CASE WHEN sr.refundMode = 'cash' THEN sr.totalAmount ELSE 0 END) AS cash,
            SUM(CASE WHEN sr.refundMode = 'credit_note' THEN sr.totalAmount ELSE 0 END) AS credit
          ${from} WHERE ${returnWhere(r)} GROUP BY 1 ORDER BY amount DESC LIMIT ${ROW_CAP}`,
      )
      const out = rows.map((x) => ({
        k: x.k,
        returns: toNum(x.returns),
        amount: toNum(x.amount),
        cash: toNum(x.cash),
        credit: toNum(x.credit),
        cost: toNum(x.cost),
        share: pct(dec(x.amount as string), amount),
      }))
      return {
        summary,
        chart: out.length > 1 ? { kind: "hbar", xKey: "k", series: [{ key: "amount", label: "Return value" }], data: out.slice(0, 10), valueType: "money" } : null,
        tables: [
          {
            key: `by-${view}`,
            columns: [
              { key: "k", label: view === "customer" ? "Customer" : "Reason" },
              { key: "returns", label: "Returns", type: "int", total: true },
              { key: "amount", label: "Value", type: "money", total: true },
              { key: "cash", label: "Cash refunds", type: "money", total: true },
              { key: "credit", label: "Credit notes", type: "money", total: true },
              { key: "cost", label: "Cost", type: "money", total: true, cost: true },
              { key: "share", label: "Share", type: "percent", total: true },
            ],
            rows: out,
            empty: "No returns in this period.",
          },
        ],
      }
    }

    const rows = await query<{
      date: Date
      number: string
      invoice: string
      customer: string
      branchId: string
      reason: string | null
      refundMode: string
      status: string
      qty: unknown
      amount: unknown
      cost: unknown
    }>(sql`SELECT sr.date, sr.number, i.number AS invoice, COALESCE(c.name, i.customerName, 'Walk-in customer') AS customer,
        sr.branchId, sr.reason, sr.refundMode, sr.status,
        (SELECT SUM(rl.quantity) FROM sales_return_lines rl WHERE rl.returnId = sr.id) AS qty,
        sr.totalAmount AS amount, sr.costAmount AS cost
      ${from} WHERE ${returnWhere(r)} ORDER BY sr.date DESC LIMIT ${ROW_CAP + 1}`)
    const out: ReportRow[] = rows.slice(0, ROW_CAP).map((x) => ({
      date: toIso(x.date),
      number: x.number,
      invoice: x.invoice,
      customer: x.customer,
      branch: r.branchName(x.branchId),
      reason: x.reason || "—",
      refund: x.refundMode === "cash" ? "Cash refund" : "Credit note",
      status: humanize(x.status),
      qty: toNum(x.qty),
      amount: toNum(x.amount),
      cost: toNum(x.cost),
    }))
    return {
      summary,
      tables: [
        {
          key: "returns",
          columns: [
            { key: "date", label: "Date", type: "datetime" },
            { key: "number", label: "Return" },
            { key: "invoice", label: "Invoice" },
            { key: "customer", label: "Customer" },
            { key: "branch", label: "Branch" },
            { key: "reason", label: "Reason" },
            { key: "refund", label: "Refund" },
            { key: "status", label: "Status" },
            { key: "qty", label: "Qty", type: "qty", total: true },
            { key: "amount", label: "Value", type: "money", total: true },
            { key: "cost", label: "Cost", type: "money", total: true, cost: true },
          ],
          rows: out,
          totals: rows.length > ROW_CAP ? { date: "Total", amount: num(amount), cost: toNum(agg?.cost) } : undefined,
          totalRows: rows.length > ROW_CAP ? toNum(agg?.returns) : undefined,
          empty: "No returns in this period.",
        },
      ],
    }
  },
}

export const ITEM_REPORTS: ReportDef[] = [topItems, returnsReport, customerProducts]
