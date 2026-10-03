import "server-only"
import { CalendarClock, Printer, TrendingUp, UserCheck } from "lucide-react"
import { can } from "@/server/auth/context"
import { dec, num } from "@/server/decimal"
import { money } from "@/lib/format"
import { ownSalesSql, type ReportDef, type RunCtx } from "../framework"
import { empty, inList, periodOf, query, returnPeriodOf, ROW_CAP, sql, toIso, toNum, toYmd, type Sql } from "../sql"
import type { ReportColumn, ReportResult, ReportRow, ReportTable } from "../types"
import { computeTotals, displayDate, pct } from "../utils"
import {
  approvedReturnScope,
  categoryFilter,
  expenseScope,
  fillPeriods,
  humanize,
  invoiceScope,
  METHOD_LABEL,
  salesmanFilter,
} from "./common"

// ───────────── shared invoice metrics ─────────────

type InvAgg = {
  k: string | null
  invoices: bigint
  customers?: bigint
  gross: unknown
  discount: unknown
  net: unknown
  cash: unknown
  credit: unknown
  paid: unknown
  due: unknown
  cogs: unknown
}
type RetAgg = { k: string | null; ret: unknown; retCost: unknown; returns: bigint }

const INVOICE_METRICS = sql`COUNT(*) AS invoices, COUNT(DISTINCT i.customerId) AS customers,
  SUM(i.subtotal) AS gross, SUM(i.discount) AS discount, SUM(i.total) AS net,
  SUM(CASE WHEN i.type = 'cash' THEN i.total ELSE 0 END) AS cash,
  SUM(CASE WHEN i.type = 'credit' THEN i.total ELSE 0 END) AS credit,
  SUM(i.paidAmount) AS paid, SUM(i.dueAmount) AS due, SUM(i.costTotal) AS cogs`

async function invoiceAgg(r: RunCtx, key: Sql) {
  return query<InvAgg>(sql`SELECT ${key} AS k, ${INVOICE_METRICS} FROM invoices i WHERE ${invoiceScope(r)} GROUP BY 1`)
}

async function returnAgg(r: RunCtx, key: Sql) {
  return query<RetAgg>(sql`SELECT ${key} AS k, COUNT(*) AS returns, SUM(sr.totalAmount) AS ret, SUM(sr.costAmount) AS retCost
    FROM sales_returns sr JOIN invoices i ON i.id = sr.invoiceId
    WHERE ${approvedReturnScope(r)} GROUP BY 1`)
}

/** Metrics for one group: net sales less approved returns, COGS less returned cost (FIN-02 semantics). */
function metrics(a: InvAgg | undefined, ret: RetAgg | undefined): ReportRow {
  const net = dec(a?.net as string)
  const returns = dec(ret?.ret as string)
  const netAfter = net.minus(returns)
  const cogs = dec(a?.cogs as string).minus(dec(ret?.retCost as string))
  const profit = netAfter.minus(cogs)
  return {
    invoices: toNum(a?.invoices),
    gross: toNum(a?.gross),
    discount: toNum(a?.discount),
    net: num(net),
    returns: num(returns),
    netAfter: num(netAfter),
    cash: toNum(a?.cash),
    credit: toNum(a?.credit),
    paid: toNum(a?.paid),
    due: toNum(a?.due),
    cogs: num(cogs),
    profit: num(profit),
    margin: pct(profit, netAfter),
  }
}

const METRIC_COLUMNS: ReportColumn[] = [
  { key: "invoices", label: "Invoices", type: "int", total: true },
  { key: "gross", label: "Gross sales", type: "money", total: true },
  { key: "discount", label: "Discount", type: "money", total: true },
  { key: "net", label: "Net sales", type: "money", total: true },
  { key: "returns", label: "Returns", type: "money", total: true },
  { key: "netAfter", label: "Net of returns", type: "money", total: true },
  { key: "cash", label: "Cash sales", type: "money", total: true },
  { key: "credit", label: "Credit sales", type: "money", total: true },
  { key: "due", label: "Due", type: "money", total: true },
  { key: "cogs", label: "COGS", type: "money", total: true, cost: true },
  { key: "profit", label: "Gross profit", type: "money", total: true, cost: true, tone: "signed" },
  { key: "margin", label: "Margin", type: "percent", cost: true },
]

/** Totals row plus the overall margin (not a sum). */
function totalsWithMargin(columns: ReportColumn[], rows: ReportRow[], revenueKey = "netAfter") {
  const t = computeTotals(columns, rows)
  if (t) t.margin = pct(Number(t.profit ?? 0), Number(t[revenueKey] ?? 0))
  return t
}

function merge(inv: InvAgg[], ret: RetAgg[]) {
  const keys = new Set<string>([...inv.map((x) => x.k ?? ""), ...ret.map((x) => x.k ?? "")])
  const im = new Map(inv.map((x) => [x.k ?? "", x]))
  const rm = new Map(ret.map((x) => [x.k ?? "", x]))
  return [...keys].map((k) => ({ k, row: metrics(im.get(k), rm.get(k)) }))
}

async function userNames(r: RunCtx, ids: string[]) {
  const list = ids.filter(Boolean)
  if (!list.length) return new Map<string, string>()
  const users = await r.db.user.findMany({ where: { id: { in: list } }, select: { id: true, name: true } })
  return new Map(users.map((u) => [u.id, u.name]))
}

function salesSummary(rows: ReportRow[]): ReportResult["summary"] {
  const t = computeTotals(METRIC_COLUMNS, rows) ?? {}
  const profit = Number(t.profit ?? 0)
  return [
    { label: "Net sales", value: Number(t.net ?? 0), type: "money", hint: `${Number(t.invoices ?? 0)} invoices` },
    { label: "Returns", value: Number(t.returns ?? 0), type: "money", hint: "Approved in this period" },
    { label: "Net of returns", value: Number(t.netAfter ?? 0), type: "money" },
    {
      label: "Gross profit",
      value: profit,
      type: "money",
      tone: profit < 0 ? "danger" : "success",
      hint: `${pct(profit, Number(t.netAfter ?? 0))}% margin`,
      cost: true,
    },
  ]
}

// ───────────── Sales report (daily / monthly / breakdowns) ─────────────

const SALES_VIEWS = [
  { value: "day", label: "By day" },
  { value: "month", label: "By month" },
  { value: "branch", label: "By branch" },
  { value: "salesman", label: "By salesman" },
  { value: "product", label: "By product" },
  { value: "category", label: "By category" },
  { value: "invoice", label: "Invoices" },
]

async function salesByPeriod(r: RunCtx, period: "day" | "month"): Promise<ReportResult> {
  const [inv, ret] = await Promise.all([invoiceAgg(r, periodOf("i.invoiceDate", period)), returnAgg(r, returnPeriodOf(period))])
  const map = new Map(merge(inv, ret).map(({ k, row }) => [k, { period: k, ...row }]))
  const zero = () => metrics(undefined, undefined)
  const rows = fillPeriods(map, r.from, r.to, period, zero).map((row) =>
    period === "month" ? { ...row, period: displayDate(String(row.period)) } : row,
  )
  const columns: ReportColumn[] = [{ key: "period", label: period === "day" ? "Date" : "Month", type: period === "day" ? "date" : "text" }, ...METRIC_COLUMNS]
  return {
    summary: salesSummary(rows),
    chart: {
      kind: "bar",
      xKey: "period",
      series: [
        { key: "netAfter", label: "Net sales" },
        { key: "profit", label: "Gross profit", cost: true },
      ],
      data: rows.map((x) => ({ period: period === "day" ? displayDate(String(x.period)).slice(0, 6) : x.period, netAfter: x.netAfter, profit: x.profit })),
      valueType: "money",
    },
    tables: [{ key: "sales", columns, rows, totals: totalsWithMargin(columns, rows), empty: "No sales in this period." }],
  }
}

async function salesByGroup(r: RunCtx, by: "branch" | "salesman"): Promise<ReportResult> {
  const key = by === "branch" ? sql`i.branchId` : sql`i.salesmanId`
  const [inv, ret] = await Promise.all([invoiceAgg(r, key), returnAgg(r, key)])
  const merged = merge(inv, ret)
  const names = by === "salesman" ? await userNames(r, merged.map((m) => m.k)) : null
  const rows = merged
    .map(({ k, row }): ReportRow => ({ name: by === "branch" ? r.branchName(k) : (names!.get(k) ?? "Unassigned (counter)"), ...row }))
    .sort((a, b) => Number(b.netAfter) - Number(a.netAfter))
  const columns: ReportColumn[] = [{ key: "name", label: by === "branch" ? "Branch" : "Salesman" }, ...METRIC_COLUMNS]
  return {
    summary: salesSummary(rows),
    chart: rows.length > 1 ? { kind: "hbar", xKey: "name", series: [{ key: "netAfter", label: "Net sales" }], data: rows.slice(0, 15), valueType: "money" } : null,
    tables: [{ key: "sales", columns, rows, totals: totalsWithMargin(columns, rows), empty: "No sales in this period." }],
  }
}

type LineAgg = {
  k: string
  sku: string
  product: string
  variation: string
  category: string | null
  items?: bigint
  qty: unknown
  retQty: unknown
  revenue: unknown
  retValue: unknown
  cost: unknown
  invoices: bigint
}

function lineMetrics(a: LineAgg): ReportRow {
  const netRevenue = dec(a.revenue as string).minus(dec(a.retValue as string))
  const cogs = dec(a.cost as string)
  const profit = netRevenue.minus(cogs)
  const netQty = dec(a.qty as string).minus(dec(a.retQty as string))
  return {
    qty: toNum(a.qty),
    retQty: toNum(a.retQty),
    revenue: toNum(a.revenue),
    netRevenue: num(netRevenue),
    avgPrice: netQty.isZero() ? 0 : num(netRevenue.div(netQty).toDecimalPlaces(2)),
    invoices: toNum(a.invoices),
    cogs: num(cogs),
    profit: num(profit),
    margin: pct(profit, netRevenue),
  }
}

/** Line-level aggregates (line values before invoice-level discount; returns netted per sold line). */
function lineAggSql(r: RunCtx, key: Sql, extraCols: Sql, extraWhere: Sql = empty) {
  const cat = r.value("categoryId")
  return sql`SELECT ${key} AS k, ${extraCols},
      SUM(il.quantity) AS qty, SUM(il.returnedQty) AS retQty, SUM(il.lineTotal) AS revenue,
      SUM(CASE WHEN il.quantity > 0 THEN il.lineTotal * il.returnedQty / il.quantity ELSE 0 END) AS retValue,
      SUM((il.quantity - il.returnedQty) * il.unitCost) AS cost, COUNT(DISTINCT i.id) AS invoices
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoiceId
    JOIN product_variations v ON v.id = il.variationId
    JOIN products p ON p.id = v.productId
    LEFT JOIN categories cat ON cat.id = p.categoryId
    WHERE ${invoiceScope(r)} ${cat ? sql`AND p.categoryId = ${cat}` : empty} ${extraWhere}
    GROUP BY 1`
}

const LINE_COLUMNS: ReportColumn[] = [
  { key: "qty", label: "Qty sold", type: "qty", total: true },
  { key: "retQty", label: "Returned", type: "qty", total: true },
  { key: "revenue", label: "Line value", type: "money", total: true },
  { key: "netRevenue", label: "Net revenue", type: "money", total: true },
  { key: "avgPrice", label: "Avg price", type: "money" },
  { key: "invoices", label: "Invoices", type: "int" },
  { key: "cogs", label: "COGS", type: "money", total: true, cost: true },
  { key: "profit", label: "Profit", type: "money", total: true, cost: true, tone: "signed" },
  { key: "margin", label: "Margin", type: "percent", cost: true },
]

async function salesByProduct(r: RunCtx): Promise<ReportResult> {
  const rows = await query<LineAgg>(
    lineAggSql(r, sql`il.variationId`, sql`MAX(v.sku) AS sku, MAX(p.name) AS product, MAX(v.name) AS variation, MAX(cat.name) AS category`),
  )
  const out = rows
    .map((a): ReportRow => ({ sku: a.sku, product: a.product, variation: a.variation, category: a.category ?? "—", ...lineMetrics(a) }))
    .sort((a, b) => Number(b.netRevenue) - Number(a.netRevenue))
  const columns: ReportColumn[] = [
    { key: "sku", label: "SKU" },
    { key: "product", label: "Product" },
    { key: "variation", label: "Variation" },
    { key: "category", label: "Category" },
    ...LINE_COLUMNS,
  ]
  const capped = out.slice(0, ROW_CAP)
  return {
    summary: lineSummary(out),
    tables: [
      {
        key: "products",
        columns,
        rows: capped,
        totals: totalsWithMargin(columns, out, "netRevenue"),
        totalRows: out.length > ROW_CAP ? out.length : undefined,
        empty: "No products sold in this period.",
      },
    ],
    notes: ["Product values are line values before invoice-level discounts; returns are netted against the lines they came from."],
  }
}

function lineSummary(rows: ReportRow[]): ReportResult["summary"] {
  const t = computeTotals(LINE_COLUMNS, rows) ?? {}
  const profit = Number(t.profit ?? 0)
  return [
    { label: "Items sold", value: rows.length, type: "int", hint: "Distinct variations" },
    { label: "Quantity sold", value: Number(t.qty ?? 0), type: "qty" },
    { label: "Net revenue", value: Number(t.netRevenue ?? 0), type: "money" },
    { label: "Profit", value: profit, type: "money", tone: profit < 0 ? "danger" : "success", cost: true },
  ]
}

async function salesByCategory(r: RunCtx): Promise<ReportResult> {
  const rows = await query<LineAgg>(
    lineAggSql(r, sql`COALESCE(p.categoryId, '')`, sql`MAX(cat.name) AS category, COUNT(DISTINCT il.variationId) AS items, '' AS sku, '' AS product, '' AS variation`),
  )
  const totalRevenue = rows.reduce((s, a) => s.plus(dec(a.revenue as string)).minus(dec(a.retValue as string)), dec(0))
  const out = rows
    .map((a): ReportRow => {
      const m = lineMetrics(a)
      return { category: a.category ?? "Uncategorised", items: toNum(a.items), ...m, share: pct(Number(m.netRevenue), totalRevenue) }
    })
    .sort((a, b) => Number(b.netRevenue) - Number(a.netRevenue))
  const columns: ReportColumn[] = [
    { key: "category", label: "Category" },
    { key: "items", label: "Items", type: "int" },
    ...LINE_COLUMNS.filter((c) => c.key !== "avgPrice"),
    { key: "share", label: "Share", type: "percent" },
  ]
  return {
    summary: lineSummary(out),
    chart: out.length > 1 ? { kind: "hbar", xKey: "category", series: [{ key: "netRevenue", label: "Net revenue" }], data: out.slice(0, 12), valueType: "money" } : null,
    tables: [{ key: "categories", columns, rows: out, totals: totalsWithMargin(columns, out, "netRevenue"), empty: "No sales in this period." }],
  }
}

type InvoiceRow = {
  id: string
  number: string
  invoiceDate: Date
  branchId: string
  type: string
  status: string
  customer: string | null
  salesman: string | null
  total: unknown
  paidAmount: unknown
  dueAmount: unknown
  costTotal: unknown
  returnedAmount: unknown
}

async function invoiceList(r: RunCtx, limit = ROW_CAP) {
  return query<InvoiceRow>(sql`SELECT i.id, i.number, i.invoiceDate, i.branchId, i.type, i.status,
      COALESCE(c.name, i.customerName, 'Walk-in customer') AS customer, u.name AS salesman,
      i.total, i.paidAmount, i.dueAmount, i.costTotal, i.returnedAmount
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customerId
    LEFT JOIN users u ON u.id = i.salesmanId
    WHERE ${invoiceScope(r)}
    ORDER BY i.invoiceDate DESC, i.number DESC
    LIMIT ${limit + 1}`)
}

async function invoiceTotals(r: RunCtx) {
  const [t] = await query<InvAgg>(sql`SELECT '' AS k, ${INVOICE_METRICS} FROM invoices i WHERE ${invoiceScope(r)}`)
  return t
}

const INVOICE_COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date", type: "datetime" },
  { key: "number", label: "Invoice" },
  { key: "branch", label: "Branch" },
  { key: "customer", label: "Customer" },
  { key: "salesman", label: "Salesman" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "total", label: "Total", type: "money", total: true },
  { key: "paid", label: "Paid", type: "money", total: true },
  { key: "due", label: "Due", type: "money", total: true },
  { key: "cost", label: "Cost", type: "money", total: true, cost: true },
  { key: "profit", label: "Profit", type: "money", total: true, cost: true, tone: "signed" },
]

function invoiceRow(r: RunCtx, i: InvoiceRow): ReportRow {
  return {
    date: toIso(i.invoiceDate),
    number: i.number,
    branch: r.branchName(i.branchId),
    customer: i.customer,
    salesman: i.salesman ?? "—",
    type: humanize(i.type),
    status: humanize(i.status),
    total: toNum(i.total),
    paid: toNum(i.paidAmount),
    due: toNum(i.dueAmount),
    cost: toNum(i.costTotal),
    profit: num(dec(i.total as string).minus(dec(i.costTotal as string))),
  }
}

async function invoiceTable(r: RunCtx, title?: string): Promise<{ table: ReportTable; agg: InvAgg | undefined }> {
  const [list, agg] = await Promise.all([invoiceList(r), invoiceTotals(r)])
  const rows = list.slice(0, ROW_CAP).map((i) => invoiceRow(r, i))
  const totals: ReportRow = {
    date: "Total",
    total: toNum(agg?.net),
    paid: toNum(agg?.paid),
    due: toNum(agg?.due),
    cost: toNum(agg?.cogs),
    profit: num(dec(agg?.net as string).minus(dec(agg?.cogs as string))),
  }
  return {
    table: {
      key: "invoices",
      title,
      columns: INVOICE_COLUMNS,
      rows,
      totals,
      totalRows: list.length > ROW_CAP ? toNum(agg?.invoices) : undefined,
      empty: "No invoices in this period.",
    },
    agg,
  }
}

const salesReport: ReportDef = {
  slug: "sales",
  title: "Sales report",
  description: "Daily or monthly sales, with breakdowns by branch, salesman, product and category.",
  group: "Sales",
  icon: TrendingUp,
  perm: ["reports.sales"],
  salesScoped: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [{ key: "view", label: "View", kind: "segment", options: SALES_VIEWS, default: "day" }, salesmanFilter, categoryFilter],
  run: async (r) => {
    const view = r.value("view")
    if (view === "month") return salesByPeriod(r, "month")
    if (view === "branch" || view === "salesman") return salesByGroup(r, view)
    if (view === "product") return salesByProduct(r)
    if (view === "category") return salesByCategory(r)
    if (view === "invoice") {
      const { table, agg } = await invoiceTable(r)
      const net = toNum(agg?.net)
      return {
        summary: [
          { label: "Invoices", value: toNum(agg?.invoices), type: "int" },
          { label: "Net sales", value: net, type: "money" },
          { label: "Collected", value: toNum(agg?.paid), type: "money" },
          { label: "Due", value: toNum(agg?.due), type: "money", tone: toNum(agg?.due) > 0 ? "warning" : "default" },
        ],
        tables: [table],
        notes: r.value("categoryId") ? ["The category filter applies to the product and category views only."] : undefined,
      }
    }
    return salesByPeriod(r, "day")
  },
}

// ───────────── Salesman-wise ─────────────

const salesmanReport: ReportDef = {
  slug: "salesman-sales",
  title: "Salesman-wise sales",
  description: "Invoices, revenue, collections, returns and profit for every salesman.",
  group: "Sales",
  icon: UserCheck,
  perm: ["reports.sales"],
  salesScoped: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [salesmanFilter],
  run: async (r) => {
    const [inv, ret] = await Promise.all([invoiceAgg(r, sql`i.salesmanId`), returnAgg(r, sql`i.salesmanId`)])
    const merged = merge(inv, ret)
    const names = await userNames(r, merged.map((m) => m.k))
    const custByKey = new Map(inv.map((x) => [x.k ?? "", toNum(x.customers)]))
    const rows = merged
      .map(({ k, row }): ReportRow => ({
        name: names.get(k) ?? "Unassigned (counter)",
        customers: custByKey.get(k) ?? 0,
        ...row,
        avg: Number(row.invoices) ? num(dec(row.net as number).div(Number(row.invoices)).toDecimalPlaces(2)) : 0,
      }))
      .sort((a, b) => Number(b.netAfter) - Number(a.netAfter))
    const columns: ReportColumn[] = [
      { key: "name", label: "Salesman" },
      { key: "invoices", label: "Invoices", type: "int", total: true },
      { key: "customers", label: "Customers", type: "int" },
      { key: "net", label: "Net sales", type: "money", total: true },
      { key: "returns", label: "Returns", type: "money", total: true },
      { key: "netAfter", label: "Net of returns", type: "money", total: true },
      { key: "avg", label: "Avg invoice", type: "money" },
      { key: "paid", label: "Collected", type: "money", total: true },
      { key: "due", label: "Due", type: "money", total: true },
      { key: "cogs", label: "COGS", type: "money", total: true, cost: true },
      { key: "profit", label: "Gross profit", type: "money", total: true, cost: true, tone: "signed" },
      { key: "margin", label: "Margin", type: "percent", cost: true },
    ]
    const totals = totalsWithMargin(columns, rows)
    return {
      summary: [
        { label: "Salesmen", value: rows.length, type: "int" },
        { label: "Net of returns", value: Number(totals?.netAfter ?? 0), type: "money" },
        { label: "Top performer", value: rows[0]?.name ?? "—", hint: rows[0] ? money(rows[0].netAfter) : undefined },
        { label: "Gross profit", value: Number(totals?.profit ?? 0), type: "money", cost: true },
      ],
      chart: rows.length > 1 ? { kind: "hbar", xKey: "name", series: [{ key: "netAfter", label: "Net sales" }], data: rows.slice(0, 15), valueType: "money" } : null,
      tables: [{ key: "salesmen", columns, rows, totals, empty: "No sales in this period." }],
    }
  },
}

// ───────────── Daily transaction summary ─────────────

const dailyTransactions: ReportDef = {
  slug: "daily-transactions",
  title: "Daily transaction summary",
  description: "All cash and credit invoices, money receipts, returns and expenses for a day.",
  group: "Sales",
  icon: CalendarClock,
  perm: ["reports.sales", "reports.financial"],
  salesScoped: true,
  date: "range",
  defaultRange: "today",
  landscape: true,
  run: async (r) => {
    const showExpenses = !r.ownSales && (can(r.ctx, "expenses.view") || can(r.ctx, "reports.financial"))
    const [{ table: invoices, agg }, receipts, returns, expenses] = await Promise.all([
      invoiceTable(r, "Invoices"),
      query<{ number: string; date: Date; branchId: string; customer: string | null; invoice: string | null; method: string; isAdvance: number; amount: unknown }>(
        sql`SELECT mr.number, mr.date, mr.branchId, COALESCE(c.name, '—') AS customer, i.number AS invoice, mr.method, mr.isAdvance, mr.amount
          FROM money_receipts mr
          LEFT JOIN customers c ON c.id = mr.customerId
          LEFT JOIN invoices i ON i.id = mr.invoiceId
          WHERE mr.companyId = ${r.companyId} AND mr.cancelledAt IS NULL AND mr.branchId IN (${inList(r.branchIds)})
            AND mr.date BETWEEN ${r.start} AND ${r.end} ${r.ownSales ? sql`AND mr.createdById = ${r.userId}` : empty}
          ORDER BY mr.date LIMIT ${ROW_CAP}`,
      ),
      query<{ number: string; date: Date; branchId: string; invoice: string; customer: string | null; refundMode: string; amount: unknown }>(
        sql`SELECT sr.number, COALESCE(sr.approvedAt, sr.date) AS date, sr.branchId, i.number AS invoice,
            COALESCE(c.name, i.customerName, 'Walk-in customer') AS customer, sr.refundMode, sr.totalAmount AS amount
          FROM sales_returns sr JOIN invoices i ON i.id = sr.invoiceId LEFT JOIN customers c ON c.id = sr.customerId
          WHERE ${approvedReturnScope(r)} ORDER BY 2 LIMIT ${ROW_CAP}`,
      ),
      showExpenses
        ? query<{ number: string; date: Date; branchId: string; category: string; description: string | null; method: string; amount: unknown; allocateToLc: number }>(
            sql`SELECT e.number, e.date, e.branchId, ec.name AS category, e.description, e.method, e.amount, e.allocateToLc
              FROM expenses e JOIN expense_categories ec ON ec.id = e.categoryId
              WHERE ${expenseScope(r)} ORDER BY e.date, e.number LIMIT ${ROW_CAP}`,
          )
        : Promise.resolve([]),
    ])

    const receiptRows = receipts.map((x) => ({
      date: toIso(x.date),
      number: x.number,
      branch: r.branchName(x.branchId),
      customer: x.customer,
      against: x.invoice ?? (x.isAdvance ? "Advance" : "On account"),
      method: METHOD_LABEL[x.method] ?? x.method,
      amount: toNum(x.amount),
    }))
    const returnRows = returns.map((x) => ({
      date: toIso(x.date),
      number: x.number,
      branch: r.branchName(x.branchId),
      invoice: x.invoice,
      customer: x.customer,
      refund: x.refundMode === "cash" ? "Cash refund" : "Credit note",
      amount: toNum(x.amount),
    }))
    const expenseRows = expenses.map((x) => ({
      date: toYmd(x.date),
      number: x.number,
      branch: r.branchName(x.branchId),
      category: x.category,
      description: x.description ?? "—",
      method: METHOD_LABEL[x.method] ?? x.method,
      lc: x.allocateToLc ? "LC cost" : "Operating",
      amount: toNum(x.amount),
    }))

    const sumOf = (rows: ReportRow[], pred: (x: ReportRow) => boolean = () => true) =>
      rows.filter(pred).reduce((s, x) => s.plus(dec(x.amount as number)), dec(0))
    const cashReceipts = sumOf(receiptRows, (x) => x.method === "Cash")
    const cashRefunds = sumOf(returnRows, (x) => x.refund === "Cash refund")
    const cashExpenses = sumOf(expenseRows, (x) => x.method === "Cash")
    const [cashSales] = await query<{ paid: unknown }>(
      sql`SELECT SUM(i.paidAmount) AS paid FROM invoices i WHERE ${invoiceScope(r)} AND i.type = 'cash'`,
    )
    const netCash = dec(cashSales?.paid as string).plus(cashReceipts).minus(cashRefunds).minus(cashExpenses)

    const tables: ReportTable[] = [
      invoices,
      {
        key: "receipts",
        title: "Money receipts",
        columns: [
          { key: "date", label: "Time", type: "datetime" },
          { key: "number", label: "Receipt" },
          { key: "branch", label: "Branch" },
          { key: "customer", label: "Customer" },
          { key: "against", label: "Against" },
          { key: "method", label: "Method" },
          { key: "amount", label: "Amount", type: "money", total: true },
        ],
        rows: receiptRows,
        empty: "No money receipts.",
      },
      {
        key: "returns",
        title: "Approved returns",
        columns: [
          { key: "date", label: "Approved", type: "datetime" },
          { key: "number", label: "Return" },
          { key: "branch", label: "Branch" },
          { key: "invoice", label: "Invoice" },
          { key: "customer", label: "Customer" },
          { key: "refund", label: "Refund" },
          { key: "amount", label: "Amount", type: "money", total: true },
        ],
        rows: returnRows,
        empty: "No returns approved.",
      },
    ]
    if (showExpenses)
      tables.push({
        key: "expenses",
        title: "Expenses",
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "number", label: "Expense" },
          { key: "branch", label: "Branch" },
          { key: "category", label: "Category" },
          { key: "description", label: "Description" },
          { key: "method", label: "Method" },
          { key: "lc", label: "Type" },
          { key: "amount", label: "Amount", type: "money", total: true },
        ],
        rows: expenseRows,
        empty: "No expenses recorded.",
      })

    return {
      summary: [
        { label: "Sales", value: toNum(agg?.net), type: "money", hint: `${toNum(agg?.invoices)} invoices · cash ${money(toNum(agg?.cash))} · credit ${money(toNum(agg?.credit))}` },
        { label: "Receipts collected", value: num(sumOf(receiptRows)), type: "money", hint: `${receiptRows.length} receipts` },
        ...(showExpenses ? [{ label: "Expenses", value: num(sumOf(expenseRows)), type: "money" as const, hint: `${expenseRows.length} entries` }] : []),
        {
          label: "Net cash movement",
          value: num(netCash),
          type: "money",
          tone: netCash.isNegative() ? "danger" : "success",
          hint: showExpenses ? "Cash sales + cash receipts − cash refunds − cash expenses" : "Cash sales + cash receipts − cash refunds",
        },
      ],
      tables,
    }
  },
}

// ───────────── Invoice print status ─────────────

const printStatus: ReportDef = {
  slug: "print-status",
  title: "Invoice print status",
  description: "Which invoices and challans are printed, not yet printed, or reprinted — and how many times.",
  group: "Sales",
  icon: Printer,
  perm: ["reports.sales"],
  salesScoped: true,
  date: "range",
  defaultRange: "this_month",
  filters: [
    {
      key: "doc",
      label: "Document",
      kind: "segment",
      default: "invoice",
      options: [
        { value: "invoice", label: "Invoices" },
        { value: "challan", label: "Challans" },
      ],
    },
    {
      key: "printed",
      label: "Print status",
      kind: "select",
      allLabel: "Any print status",
      options: [
        { value: "unprinted", label: "Not printed" },
        { value: "printed", label: "Printed once" },
        { value: "reprinted", label: "Reprinted" },
      ],
    },
  ],
  run: async (r) => {
    const challan = r.value("doc") === "challan"
    const ps = r.value("printed")
    const pc = raw2(challan ? "ch.printCount" : "i.printCount")
    const printedWhere = ps === "unprinted" ? sql`AND ${pc} = 0` : ps === "printed" ? sql`AND ${pc} = 1` : ps === "reprinted" ? sql`AND ${pc} > 1` : empty

    const from = challan
      ? sql`FROM challans ch JOIN invoices i ON i.id = ch.invoiceId LEFT JOIN customers c ON c.id = i.customerId
          WHERE ch.companyId = ${r.companyId} AND ch.branchId IN (${inList(r.branchIds)})
            AND ch.createdAt BETWEEN ${r.start} AND ${r.end} AND i.status <> 'cancelled' ${ownSalesSql(r, "i")}`
      : sql`FROM invoices i LEFT JOIN customers c ON c.id = i.customerId WHERE ${invoiceScope(r)}`

    const [stats] = await query<{ docs: bigint; unprinted: unknown; once: unknown; reprinted: unknown; extra: unknown }>(
      sql`SELECT COUNT(*) AS docs, SUM(${pc} = 0) AS unprinted, SUM(${pc} = 1) AS once, SUM(${pc} > 1) AS reprinted,
          SUM(GREATEST(${pc} - 1, 0)) AS extra ${from}`,
    )
    const list = await query<{
      date: Date
      number: string
      invoice: string
      branchId: string
      customer: string
      total: unknown
      printCount: number
      lastPrintedAt: Date | null
      delivery: string | null
    }>(
      sql`SELECT ${challan ? sql`ch.createdAt` : sql`i.invoiceDate`} AS date, ${challan ? sql`ch.number` : sql`i.number`} AS number,
          i.number AS invoice, ${challan ? sql`ch.branchId` : sql`i.branchId`} AS branchId,
          COALESCE(c.name, i.customerName, 'Walk-in customer') AS customer, i.total,
          ${pc} AS printCount, ${challan ? sql`ch.lastPrintedAt` : sql`i.lastPrintedAt`} AS lastPrintedAt,
          ${challan ? sql`ch.status` : sql`NULL`} AS delivery
        ${from} ${printedWhere}
        ORDER BY ${pc} ASC, 1 DESC LIMIT ${ROW_CAP + 1}`,
    )
    const label = (n: number) => (n === 0 ? "Not printed" : n === 1 ? "Printed" : `Reprinted ×${n - 1}`)
    const rows = list.slice(0, ROW_CAP).map((x) => ({
      date: toIso(x.date),
      number: x.number,
      invoice: x.invoice,
      branch: r.branchName(x.branchId),
      customer: x.customer,
      delivery: x.delivery ? humanize(x.delivery) : null,
      total: toNum(x.total),
      prints: toNum(x.printCount),
      last: toIso(x.lastPrintedAt),
      status: label(toNum(x.printCount)),
    }))
    const columns: ReportColumn[] = [
      { key: "date", label: "Date", type: "datetime" },
      { key: "number", label: challan ? "Challan" : "Invoice" },
      ...(challan ? [{ key: "invoice", label: "Invoice" }, { key: "delivery", label: "Delivery" }] : []),
      { key: "branch", label: "Branch" },
      { key: "customer", label: "Customer" },
      ...(challan ? [] : [{ key: "total", label: "Total", type: "money" as const }]),
      { key: "prints", label: "Prints", type: "int", total: true },
      { key: "last", label: "Last printed", type: "datetime" },
      { key: "status", label: "Status" },
    ]
    const docs = toNum(stats?.docs)
    return {
      summary: [
        { label: challan ? "Challans" : "Invoices", value: docs, type: "int" },
        { label: "Not printed", value: toNum(stats?.unprinted), type: "int", tone: toNum(stats?.unprinted) > 0 ? "warning" : "default" },
        { label: "Printed once", value: toNum(stats?.once), type: "int" },
        { label: "Reprinted", value: toNum(stats?.reprinted), type: "int", hint: `${toNum(stats?.extra)} extra copies`, tone: toNum(stats?.reprinted) > 0 ? "danger" : "default" },
      ],
      tables: [
        {
          key: "docs",
          columns,
          rows,
          totalRows: list.length > ROW_CAP ? docs : undefined,
          totals: ps ? undefined : { date: "Total", prints: num(dec(stats?.once as string).plus(dec(stats?.reprinted as string)).plus(dec(stats?.extra as string))) },
          empty: challan ? "No challans in this period." : "No invoices in this period.",
        },
      ],
    }
  },
}

function raw2(c: "ch.printCount" | "i.printCount") {
  return c === "ch.printCount" ? sql`ch.printCount` : sql`i.printCount`
}

export const SALES_REPORTS: ReportDef[] = [dailyTransactions, salesReport, salesmanReport, printStatus]
export { invoiceAgg, returnAgg, metrics, merge, userNames, totalsWithMargin, METRIC_COLUMNS }
