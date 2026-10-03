import "server-only"
import { Landmark, Scale, Truck } from "lucide-react"
import { dec, num } from "@/server/decimal"
import type { Dec } from "@/server/decimal"
import { money } from "@/lib/format"
import type { ReportDef, RunCtx } from "../framework"
import { empty, inList, query, ROW_CAP, sql, toNum, toYmd } from "../sql"
import type { ReportColumn, ReportRow } from "../types"
import { computeTotals, displayDate, pct, periodKeys } from "../utils"
import { pnlByBranch, pnlPeriods, pnlStatement } from "@/server/modules/finance/pnl"
import { expenseScope, invoiceScope, METHOD_LABEL } from "./common"

// ───────────── Profit & loss (reuses the finance module so numbers match the P&L page) ─────────────

const PL_COLUMNS: ReportColumn[] = [
  { key: "revenue", label: "Net revenue", type: "money", total: true },
  { key: "cogs", label: "COGS", type: "money", total: true },
  { key: "gross", label: "Gross profit", type: "money", total: true, tone: "signed" },
  { key: "grossMargin", label: "Gross margin", type: "percent" },
  { key: "opex", label: "Operating expenses", type: "money", total: true },
  { key: "net", label: "Net profit", type: "money", total: true, tone: "signed" },
  { key: "netMargin", label: "Net margin", type: "percent" },
]

const profitLoss: ReportDef = {
  slug: "profit-loss",
  title: "Profit & loss",
  description: "Revenue − cost of goods sold (landed cost) − operating expenses = net profit, by day, month or branch.",
  group: "Finance",
  icon: Scale,
  perm: ["reports.financial"],
  features: ["advancedReports"],
  financial: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [
    {
      key: "view",
      label: "View",
      kind: "segment",
      default: "day",
      options: [
        { value: "day", label: "Daily" },
        { value: "month", label: "Monthly" },
        { value: "branch", label: "By branch" },
      ],
    },
  ],
  run: async (r) => {
    const view = (r.value("view") ?? "day") as "day" | "month" | "branch"
    const scope = { companyId: r.companyId, branchIds: r.branchIds, from: r.from, to: r.to }
    const statement = await pnlStatement(scope)
    type Line = { label: string; netRevenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number; grossMargin: number | null }
    let lines: Line[]
    if (view === "branch") {
      const branches = r.branchIds.map((id) => ({ id, name: r.branchName(id) }))
      lines = (await pnlByBranch(scope, branches)).map((x) => ({ ...x, label: x.branchName }))
    } else {
      const keys = periodKeys(r.from, r.to, view)
      lines = (await pnlPeriods(scope, view, keys)).map((x) => ({ ...x, label: view === "day" ? x.key : displayDate(x.key) }))
    }
    const rows: ReportRow[] = lines.map((x) => ({
      label: x.label,
      revenue: x.netRevenue,
      cogs: x.cogs,
      gross: x.grossProfit,
      grossMargin: x.grossMargin ?? 0,
      opex: x.expenses,
      net: x.netProfit,
      netMargin: pct(x.netProfit, x.netRevenue),
    }))
    const first: ReportColumn =
      view === "branch" ? { key: "label", label: "Branch" } : { key: "label", label: view === "day" ? "Date" : "Month", type: view === "day" ? "date" : "text" }
    const columns = [first, ...PL_COLUMNS]
    const s = statement
    const totals: ReportRow = {
      label: "Total",
      revenue: s.netRevenue,
      cogs: s.cogs,
      gross: s.grossProfit,
      grossMargin: s.grossMargin ?? 0,
      opex: s.operatingExpenses,
      net: s.netProfit,
      netMargin: s.netMargin ?? 0,
    }
    return {
      summary: [
        { label: "Net revenue", value: s.netRevenue, type: "money", hint: `Sales ${money(s.sales)} less returns ${money(s.returns)}` },
        { label: "Cost of goods sold", value: s.cogs, type: "money", hint: "Snapshotted landed cost" },
        { label: "Gross profit", value: s.grossProfit, type: "money", hint: `${s.grossMargin ?? 0}% margin` },
        { label: "Operating expenses", value: s.operatingExpenses, type: "money", hint: `${money(s.lcAllocatedExpenses)} capitalised into LCs` },
        { label: "Net profit", value: s.netProfit, type: "money", tone: s.netProfit < 0 ? "danger" : "success", hint: `${s.netMargin ?? 0}% net margin` },
      ],
      chart: {
        kind: view === "day" && rows.length > 7 ? "area" : "bar",
        xKey: "label",
        series: [
          { key: "revenue", label: "Net revenue" },
          { key: "gross", label: "Gross profit" },
          { key: "net", label: "Net profit" },
        ],
        data: rows.map((x) => ({ ...x, label: view === "day" ? displayDate(String(x.label)).slice(0, 6) : x.label })),
        valueType: "money",
      },
      tables: [
        { key: "pl", title: "Profit & loss", columns, rows, totals, empty: "No activity in this period." },
        {
          key: "opex",
          title: "Operating expenses by category",
          columns: [
            { key: "category", label: "Category" },
            { key: "amount", label: "Amount", type: "money", total: true },
            { key: "share", label: "Share", type: "percent", total: true },
          ],
          rows: s.expenses.map((x) => ({ category: x.name, amount: x.amount, share: pct(x.amount, s.operatingExpenses) })),
          empty: "No operating expenses in this period.",
        },
      ],
      notes: [
        `Revenue = invoice totals (${s.invoiceCount} invoices, cancelled excluded) less ${s.returnCount} approved returns, by approval date.`,
        "Expenses allocated to an LC are part of landed cost (and so COGS) and are excluded from operating expenses.",
      ],
    }
  },
}


// ───────────── Daily cash closing ─────────────

const cashClosing: ReportDef = {
  slug: "cash-closing",
  title: "Daily cash closing",
  description: "Reconciled daily cash position per branch: expected vs counted cash and the difference.",
  group: "Finance",
  icon: Landmark,
  perm: ["reports.financial", "finance.cash_closing"],
  financial: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  run: async (r) => {
    const rows = await query<{
      date: Date
      branchId: string
      openingCash: unknown
      cashSales: unknown
      cashReceipts: unknown
      cashExpenses: unknown
      cashPayouts: unknown
      expectedClosing: unknown
      countedCash: unknown
      difference: unknown
      note: string | null
      closedBy: string | null
    }>(sql`SELECT cc.date, cc.branchId, cc.openingCash, cc.cashSales, cc.cashReceipts, cc.cashExpenses, cc.cashPayouts,
        cc.expectedClosing, cc.countedCash, cc.difference, cc.note, u.name AS closedBy
      FROM cash_closings cc LEFT JOIN users u ON u.id = cc.closedById
      WHERE cc.companyId = ${r.companyId} AND cc.branchId IN (${inList(r.branchIds)}) AND cc.date BETWEEN ${r.from} AND ${r.to}
      ORDER BY cc.date DESC, cc.branchId LIMIT ${ROW_CAP}`)
    const out = rows.map((x) => {
      const diff = toNum(x.difference)
      return {
        date: toYmd(x.date),
        branch: r.branchName(x.branchId),
        opening: toNum(x.openingCash),
        sales: toNum(x.cashSales),
        receipts: toNum(x.cashReceipts),
        expenses: toNum(x.cashExpenses),
        payouts: toNum(x.cashPayouts),
        expected: toNum(x.expectedClosing),
        counted: toNum(x.countedCash),
        difference: diff,
        result: diff === 0 ? "Balanced" : diff < 0 ? "Short" : "Over",
        closedBy: x.closedBy ?? "—",
        note: x.note ?? "",
      }
    })
    const columns: ReportColumn[] = [
      { key: "date", label: "Date", type: "date" },
      { key: "branch", label: "Branch" },
      { key: "opening", label: "Opening", type: "money" },
      { key: "sales", label: "Cash sales", type: "money", total: true },
      { key: "receipts", label: "Receipts", type: "money", total: true },
      { key: "expenses", label: "Expenses", type: "money", total: true },
      { key: "payouts", label: "Payouts", type: "money", total: true },
      { key: "expected", label: "Expected", type: "money" },
      { key: "counted", label: "Counted", type: "money" },
      { key: "difference", label: "Difference", type: "money", total: true, tone: "signed" },
      { key: "result", label: "Result" },
      { key: "closedBy", label: "Closed by" },
      { key: "note", label: "Note" },
    ]
    const totals = computeTotals(columns, out)
    if (totals) totals.branch = `${out.length} closings`
    const short = out.filter((x) => x.difference < 0)
    const over = out.filter((x) => x.difference > 0)
    const diff = Number(totals?.difference ?? 0)
    return {
      summary: [
        { label: "Closings", value: out.length, type: "int", hint: `${out.filter((x) => x.difference === 0).length} balanced` },
        { label: "Cash in", value: num(dec(totals?.sales as number).plus(dec(totals?.receipts as number))), type: "money", hint: "Cash sales + receipts" },
        { label: "Cash out", value: num(dec(totals?.expenses as number).plus(dec(totals?.payouts as number))), type: "money", hint: "Expenses + payouts" },
        {
          label: "Net difference",
          value: diff,
          type: "money",
          tone: diff < 0 ? "danger" : diff > 0 ? "warning" : "success",
          hint: `${short.length} short · ${over.length} over`,
        },
      ],
      tables: [{ key: "closings", columns, rows: out, totals, empty: "No cash closings recorded in this period." }],
    }
  },
}

// ───────────── Delivery charges ─────────────

type DeliveryRow = { id: string; source: "expense" | "lc"; number: string; date: string; branchId: string; lcId: string | null; amount: Dec; description: string; method: string }

/**
 * Delivery charges: expenses in the "Delivery Charge" category or linked from an LC cost item of
 * source "delivery_charge", plus delivery-charge cost items recorded on an LC without an expense.
 */
async function deliveryRows(r: RunCtx): Promise<DeliveryRow[]> {
  const lc = r.value("lcId")
  const [expenses, items] = await Promise.all([
    query<{ id: string; number: string; date: Date; branchId: string; lcId: string | null; amount: unknown; description: string | null; method: string }>(
      sql`SELECT e.id, e.number, e.date, e.branchId, e.lcId, e.amount, e.description, e.method
        FROM expenses e JOIN expense_categories ec ON ec.id = e.categoryId
        WHERE ${expenseScope(r)} ${lc ? sql`AND e.lcId = ${lc}` : empty}
          AND (ec.name = 'Delivery Charge' OR EXISTS (SELECT 1 FROM lc_cost_items ci
            WHERE ci.companyId = ${r.companyId} AND ci.sourceType = 'delivery_charge' AND ci.sourceId = e.id))
        ORDER BY e.date DESC LIMIT 20000`,
    ),
    query<{ id: string; date: Date; branchId: string; lcId: string; amount: unknown; description: string | null }>(
      sql`SELECT ci.id, ci.entryDate AS date, l.branchId, ci.lcId, ci.amount, ci.description
        FROM lc_cost_items ci JOIN lcs l ON l.id = ci.lcId
        WHERE ci.companyId = ${r.companyId} AND ci.sourceType = 'delivery_charge'
          AND l.branchId IN (${inList(r.branchIds)}) AND ci.entryDate BETWEEN ${r.from} AND ${r.to}
          ${lc ? sql`AND ci.lcId = ${lc}` : empty}
          AND (ci.sourceId IS NULL OR NOT EXISTS (SELECT 1 FROM expenses e2 WHERE e2.id = ci.sourceId AND e2.companyId = ${r.companyId}))
        LIMIT 20000`,
    ),
  ])
  return [
    ...expenses.map((e) => ({
      id: e.id,
      source: "expense" as const,
      number: e.number,
      date: toYmd(e.date)!,
      branchId: e.branchId,
      lcId: e.lcId,
      amount: dec(e.amount as string),
      description: e.description ?? "",
      method: METHOD_LABEL[e.method] ?? e.method,
    })),
    ...items.map((c) => ({
      id: c.id,
      source: "lc" as const,
      number: "LC cost item",
      date: toYmd(c.date)!,
      branchId: c.branchId,
      lcId: c.lcId,
      amount: dec(c.amount as string),
      description: c.description ?? "",
      method: "—",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))
}

function groupSum<T>(rows: T[], key: (x: T) => string, amount: (x: T) => Dec) {
  const m = new Map<string, { count: number; amount: Dec }>()
  for (const x of rows) {
    const k = key(x)
    const g = m.get(k) ?? { count: 0, amount: dec(0) }
    g.count++
    g.amount = g.amount.plus(amount(x))
    m.set(k, g)
  }
  return m
}

const deliveryCharges: ReportDef = {
  slug: "delivery-charges",
  title: "Total delivery charge report",
  description: "Delivery costs by LC, branch and date — from delivery-charge expenses and LC cost items.",
  group: "Finance",
  icon: Truck,
  perm: ["reports.financial", "reports.stock"],
  financial: true,
  date: "range",
  defaultRange: "this_month",
  landscape: true,
  filters: [
    {
      key: "view",
      label: "View",
      kind: "segment",
      default: "list",
      options: [
        { value: "list", label: "Entries" },
        { value: "lc", label: "By LC" },
        { value: "branch", label: "By branch" },
        { value: "day", label: "By date" },
      ],
    },
    { key: "lcId", label: "LC", kind: "lc" },
  ],
  run: async (r) => {
    const view = r.value("view")
    const [rows, billed] = await Promise.all([
      deliveryRows(r),
      query<{ billed: unknown }>(sql`SELECT SUM(i.deliveryCharge) AS billed FROM invoices i WHERE ${invoiceScope(r)}`),
    ])
    const lcIds = [...new Set(rows.map((x) => x.lcId).filter((x): x is string => !!x))]
    const lcs = lcIds.length
      ? await r.db.lc.findMany({ where: { id: { in: lcIds } }, select: { id: true, lcNumber: true, supplier: { select: { name: true } } } })
      : []
    const lcMap = new Map(lcs.map((l) => [l.id, l]))
    const total = rows.reduce<Dec>((s, x) => s.plus(x.amount), dec(0))
    const linked = rows.filter((x) => x.lcId).reduce<Dec>((s, x) => s.plus(x.amount), dec(0))
    const summary = [
      { label: "Delivery charges", value: num(total), type: "money" as const, hint: `${rows.length} entries` },
      { label: "Allocated to LCs", value: num(linked), type: "money" as const, hint: `${lcIds.length} LCs` },
      { label: "Not linked to an LC", value: num(total.minus(linked)), type: "money" as const },
      { label: "Billed to customers", value: toNum(billed[0]?.billed), type: "money" as const, hint: "Delivery charge on invoices" },
    ]

    if (view === "lc" || view === "branch" || view === "day") {
      const key = (x: DeliveryRow) => (view === "lc" ? (x.lcId ?? "") : view === "branch" ? x.branchId : x.date)
      const groups = [...groupSum(rows, key, (x) => x.amount).entries()]
      const out = groups
        .map(([k, g]) => ({
          label: view === "lc" ? (k ? (lcMap.get(k)?.lcNumber ?? "—") : "Not linked to an LC") : view === "branch" ? r.branchName(k) : k,
          supplier: view === "lc" ? (k ? (lcMap.get(k)?.supplier.name ?? "—") : "—") : null,
          entries: g.count,
          amount: num(g.amount),
          share: pct(g.amount, total),
        }))
        .sort((a, b) => (view === "day" ? String(b.label).localeCompare(String(a.label)) : b.amount - a.amount))
      const columns: ReportColumn[] = [
        { key: "label", label: view === "lc" ? "LC" : view === "branch" ? "Branch" : "Date", type: view === "day" ? "date" : "text" },
        ...(view === "lc" ? [{ key: "supplier", label: "Supplier" }] : []),
        { key: "entries", label: "Entries", type: "int", total: true },
        { key: "amount", label: "Amount", type: "money", total: true },
        { key: "share", label: "Share", type: "percent", total: true },
      ]
      const totals = computeTotals(columns, out)
      return {
        summary,
        chart:
          out.length > 1
            ? {
                kind: view === "day" ? "bar" : "hbar",
                xKey: "label",
                series: [{ key: "amount", label: "Delivery charges" }],
                data: view === "day" ? [...out].reverse().map((x) => ({ ...x, label: displayDate(String(x.label)).slice(0, 6) })) : out.slice(0, 12),
                valueType: "money",
              }
            : null,
        tables: [{ key: `by-${view}`, columns, rows: out, totals, empty: "No delivery charges in this period." }],
      }
    }

    const out = rows.slice(0, ROW_CAP).map((x) => ({
      date: x.date,
      number: x.number,
      branch: r.branchName(x.branchId),
      lc: x.lcId ? (lcMap.get(x.lcId)?.lcNumber ?? "—") : "—",
      description: x.description || "—",
      method: x.method,
      amount: num(x.amount),
    }))
    return {
      summary,
      tables: [
        {
          key: "entries",
          columns: [
            { key: "date", label: "Date", type: "date" },
            { key: "number", label: "Reference" },
            { key: "branch", label: "Branch" },
            { key: "lc", label: "LC" },
            { key: "description", label: "Description" },
            { key: "method", label: "Method" },
            { key: "amount", label: "Amount", type: "money", total: true },
          ],
          rows: out,
          totals: { date: null, number: "Total", amount: num(total) },
          totalRows: rows.length > ROW_CAP ? rows.length : undefined,
          empty: "No delivery charges in this period.",
        },
      ],
    }
  },
}

export const FINANCE_REPORTS: ReportDef[] = [profitLoss, cashClosing, deliveryCharges]
