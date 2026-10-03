import "server-only"
import { BookOpenText, Factory, HandCoins } from "lucide-react"
import { dec, num, type Dec } from "@/server/decimal"
import type { ReportDef, RunCtx } from "../framework"
import { dayOf, empty, inList, query, ROW_CAP, sql, toIso, toNum } from "../sql"
import { money } from "@/lib/format"
import type { ReportColumn, ReportRow } from "../types"
import { AGING_BUCKETS, ageDues, computeTotals, pct } from "../utils"
import { humanize, SOLD } from "./common"

// ───────────── Customer outstanding & aging ─────────────

const customerOutstanding: ReportDef = {
  slug: "customer-outstanding",
  title: "Customer outstanding",
  description: "Customer balances, credit limits and overdue credit invoices aged 0–30 / 31–60 / 61–90 / 90+ days.",
  group: "Customers & suppliers",
  icon: HandCoins,
  perm: ["reports.sales", "reports.financial"],
  features: ["crm"],
  date: "asOf",
  landscape: true,
  filters: [
    {
      key: "balance",
      label: "Balance",
      kind: "select",
      default: "nonzero",
      allLabel: "All customers",
      options: [
        { value: "nonzero", label: "With a balance" },
        { value: "due", label: "Dues only" },
        { value: "advance", label: "Advances only" },
        { value: "overlimit", label: "Over credit limit" },
      ],
    },
    {
      key: "type",
      label: "Customer type",
      kind: "select",
      allLabel: "All types",
      options: [
        { value: "retail", label: "Retail" },
        { value: "wholesale", label: "Wholesale" },
        { value: "dealer", label: "Dealer" },
      ],
    },
  ],
  run: async (r) => {
    const bal = r.value("balance")
    const type = r.value("type")
    const balWhere =
      bal === "due"
        ? sql`AND c.balance > 0`
        : bal === "advance"
          ? sql`AND c.balance < 0`
          : bal === "overlimit"
            ? sql`AND c.creditLimit > 0 AND c.balance > c.creditLimit`
            : bal === "nonzero"
              ? sql`AND c.balance <> 0`
              : empty
    const branchWhere = r.branchId
      ? sql`AND (c.branchId = ${r.branchId} OR EXISTS (SELECT 1 FROM invoices bi WHERE bi.companyId = ${r.companyId}
          AND bi.customerId = c.id AND bi.branchId = ${r.branchId} AND bi.status IN ${SOLD}))`
      : empty
    const where = sql`c.companyId = ${r.companyId} ${balWhere} ${type ? sql`AND c.type = ${type}` : empty} ${branchWhere}`
    const [customers, [agg]] = await Promise.all([
      query<{ id: string; code: string; name: string; phone: string | null; type: string; creditLimit: unknown; balance: unknown; lastPayment: Date | null }>(
        sql`SELECT c.id, c.code, c.name, c.phone, c.type, c.creditLimit, c.balance,
            (SELECT MAX(mr.date) FROM money_receipts mr WHERE mr.companyId = ${r.companyId} AND mr.customerId = c.id AND mr.cancelledAt IS NULL) AS lastPayment
          FROM customers c WHERE ${where} ORDER BY c.balance DESC, c.name LIMIT ${ROW_CAP + 1}`,
      ),
      query<{ customers: bigint; due: unknown; advance: unknown; withDue: unknown; overLimit: unknown }>(
        sql`SELECT COUNT(*) AS customers, SUM(GREATEST(c.balance, 0)) AS due, SUM(LEAST(c.balance, 0)) AS advance,
            SUM(c.balance > 0) AS withDue, SUM(c.creditLimit > 0 AND c.balance > c.creditLimit) AS overLimit
          FROM customers c WHERE ${where}`,
      ),
    ])
    const page = customers.slice(0, ROW_CAP)
    const ids = page.map((c) => c.id)
    // open credit invoices for aging, scoped to the user's branches
    const dues = ids.length
      ? await query<{ customerId: string; d: string; due: unknown }>(
          sql`SELECT i.customerId, ${dayOf("i.invoiceDate")} AS d, i.dueAmount AS due FROM invoices i
            WHERE i.companyId = ${r.companyId} AND i.status IN ${SOLD} AND i.dueAmount > 0
              AND i.branchId IN (${inList(r.branchIds)}) AND i.invoiceDate <= ${r.end} AND i.customerId IN (${inList(ids)})`,
        )
      : []
    const byCustomer = new Map<string, { invoiceDate: string; due: string }[]>()
    for (const d of dues) {
      const list = byCustomer.get(d.customerId) ?? []
      list.push({ invoiceDate: d.d, due: String(d.due) })
      byCustomer.set(d.customerId, list)
    }
    const rows: ReportRow[] = page.map((c) => {
      const balance = dec(c.balance as string)
      const limit = dec(c.creditLimit as string)
      const aging = ageDues(byCustomer.get(c.id) ?? [], r.to)
      return {
        code: c.code,
        name: c.name,
        phone: c.phone ?? "—",
        type: humanize(c.type),
        limit: num(limit),
        due: balance.gt(0) ? num(balance) : 0,
        advance: balance.lt(0) ? num(balance.neg()) : 0,
        used: limit.gt(0) && balance.gt(0) ? pct(balance, limit) : 0,
        ...aging,
        unaged: num(dec(balance.gt(0) ? balance : 0).minus(dec(aging.b0_30).plus(aging.b31_60).plus(aging.b61_90).plus(aging.b90))),
        status: balance.lte(0) ? (balance.isZero() ? "Settled" : "Advance") : limit.gt(0) && balance.gt(limit) ? "Over limit" : aging.b90 > 0 ? "Overdue 90+" : "Due",
        lastPayment: toIso(c.lastPayment),
      }
    })
    const columns: ReportColumn[] = [
      { key: "code", label: "Code" },
      { key: "name", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "type", label: "Type" },
      { key: "limit", label: "Credit limit", type: "money" },
      { key: "due", label: "Due", type: "money", total: true },
      { key: "advance", label: "Advance", type: "money", total: true },
      { key: "used", label: "Limit used", type: "percent" },
      ...AGING_BUCKETS.map((b) => ({ key: b.key, label: b.label, type: "money" as const, total: true })),
      { key: "unaged", label: "Opening / unallocated", type: "money", total: true },
      { key: "status", label: "Status" },
      { key: "lastPayment", label: "Last payment", type: "datetime" },
    ]
    const totals = computeTotals(columns, rows)
    if (totals && customers.length > ROW_CAP) {
      totals.due = toNum(agg?.due)
      totals.advance = -toNum(agg?.advance)
    }
    return {
      summary: [
        { label: "Total receivable", value: toNum(agg?.due), type: "money", hint: `${toNum(agg?.withDue)} customers owe` },
        { label: "Advances held", value: -toNum(agg?.advance), type: "money" },
        { label: "90+ days overdue", value: Number(totals?.b90 ?? 0), type: "money", tone: Number(totals?.b90 ?? 0) > 0 ? "danger" : "default" },
        { label: "Over credit limit", value: toNum(agg?.overLimit), type: "int", tone: toNum(agg?.overLimit) > 0 ? "warning" : "default" },
      ],
      chart: {
        kind: "bar",
        title: "Aging of open credit invoices",
        xKey: "bucket",
        series: [{ key: "amount", label: "Outstanding" }],
        data: AGING_BUCKETS.map((b) => ({ bucket: b.label, amount: Number(totals?.[b.key] ?? 0) })),
        valueType: "money",
      },
      tables: [
        {
          key: "outstanding",
          columns,
          rows,
          totals,
          totalRows: customers.length > ROW_CAP ? toNum(agg?.customers) : undefined,
          empty: "No customers with an outstanding balance.",
        },
      ],
      notes: [
        "Due / advance are current balances from the customer ledger. Aging uses the open due of each credit invoice, as of the selected date; \"Opening / unallocated\" is the part of the balance not tied to an open invoice (opening dues, or payments on account not yet allocated when negative).",
        ...(r.branchId ? ["Branch filter: customers of that branch or with invoices there; aging counts that branch's invoices only."] : []),
      ],
    }
  },
}

// ───────────── Customer ledger ─────────────

const LEDGER_LABEL: Record<string, string> = {
  opening: "Opening balance",
  invoice: "Invoice",
  payment: "Payment",
  return: "Return",
  credit_note: "Credit note",
  refund: "Refund",
  adjustment: "Adjustment",
  purchase: "Purchase",
}

/** Document numbers for ledger references (refId may point to any of these). */
async function refNumbers(r: RunCtx, ids: string[]) {
  if (!ids.length) return new Map<string, string>()
  const list = inList(ids)
  const rows = await query<{ id: string; number: string }>(sql`
    SELECT id, number FROM invoices WHERE companyId = ${r.companyId} AND id IN (${list})
    UNION ALL SELECT id, number FROM money_receipts WHERE companyId = ${r.companyId} AND id IN (${list})
    UNION ALL SELECT id, number FROM sales_returns WHERE companyId = ${r.companyId} AND id IN (${list})
    UNION ALL SELECT id, number FROM credit_notes WHERE companyId = ${r.companyId} AND id IN (${list})
    UNION ALL SELECT id, number FROM supplier_payments WHERE companyId = ${r.companyId} AND id IN (${list})
    UNION ALL SELECT id, number FROM goods_receipts WHERE companyId = ${r.companyId} AND id IN (${list})
    UNION ALL SELECT id, lcNumber AS number FROM lcs WHERE companyId = ${r.companyId} AND id IN (${list})`)
  return new Map(rows.map((x) => [x.id, x.number]))
}

const customerLedger: ReportDef = {
  slug: "customer-ledger",
  title: "Customer ledger",
  description: "Full transaction history of one customer with opening balance carried forward and running balance.",
  group: "Customers & suppliers",
  icon: BookOpenText,
  perm: ["reports.sales", "reports.financial"],
  features: ["crm"],
  date: "range",
  defaultRange: "this_year",
  branch: false,
  filters: [{ key: "customerId", label: "Customer", kind: "customer", required: true }],
  run: async (r) => {
    const customerId = r.value("customerId")
    const customer = customerId
      ? await r.db.customer.findFirst({ where: { id: customerId }, select: { id: true, name: true, code: true, balance: true, creditLimit: true } })
      : null
    if (!customer) return { tables: [], prompt: { title: "Choose a customer", text: "Pick a customer above to see their ledger for the selected period." } }
    const [[open], entries] = await Promise.all([
      query<{ bal: unknown }>(
        sql`SELECT SUM(debit - credit) AS bal FROM customer_ledger_entries WHERE companyId = ${r.companyId} AND customerId = ${customer.id} AND date < ${r.start}`,
      ),
      query<{ date: Date; type: string; debit: unknown; credit: unknown; refType: string | null; refId: string | null; note: string | null; branchId: string | null }>(
        sql`SELECT date, type, debit, credit, refType, refId, note, branchId FROM customer_ledger_entries
          WHERE companyId = ${r.companyId} AND customerId = ${customer.id} AND date BETWEEN ${r.start} AND ${r.end}
          ORDER BY date, createdAt LIMIT ${ROW_CAP}`,
      ),
    ])
    const refs = await refNumbers(r, [...new Set(entries.map((e) => e.refId).filter((x): x is string => !!x))])
    const opening = dec(open?.bal as string)
    let running: Dec = opening
    let debit: Dec = dec(0)
    let credit: Dec = dec(0)
    const rows: ReportRow[] = [{ date: null, type: "Opening balance", ref: "—", note: "Brought forward", branch: "", debit: null, credit: null, balance: num(opening) }]
    for (const e of entries) {
      const d = dec(e.debit as string)
      const c = dec(e.credit as string)
      running = running.plus(d).minus(c)
      debit = debit.plus(d)
      credit = credit.plus(c)
      rows.push({
        date: toIso(e.date),
        type: LEDGER_LABEL[e.type] ?? humanize(e.type),
        ref: (e.refId && refs.get(e.refId)) || (e.refType ? humanize(e.refType) : "—"),
        note: e.note ?? "",
        branch: e.branchId ? r.branchName(e.branchId) : "",
        debit: d.isZero() ? null : num(d),
        credit: c.isZero() ? null : num(c),
        balance: num(running),
      })
    }
    return {
      summary: [
        { label: "Opening balance", value: num(opening), type: "money", hint: opening.isNegative() ? "Advance" : undefined },
        { label: "Debits", value: num(debit), type: "money", hint: "Invoices, refunds" },
        { label: "Credits", value: num(credit), type: "money", hint: "Payments, returns, credit notes" },
        {
          label: "Closing balance",
          value: num(running),
          type: "money",
          tone: running.gt(0) ? "warning" : "success",
          hint: `Current ${money(num(customer.balance))} · limit ${money(num(customer.creditLimit))}`,
        },
      ],
      tables: [
        {
          key: "ledger",
          title: `${customer.name} (${customer.code})`,
          columns: [
            { key: "date", label: "Date", type: "datetime" },
            { key: "type", label: "Type" },
            { key: "ref", label: "Reference" },
            { key: "note", label: "Note" },
            { key: "branch", label: "Branch" },
            { key: "debit", label: "Debit", type: "money" },
            { key: "credit", label: "Credit", type: "money" },
            { key: "balance", label: "Balance", type: "money", tone: "positive-bad" },
          ],
          rows,
          totals: { type: "Closing balance", debit: num(debit), credit: num(credit), balance: num(running) },
          totalRows: entries.length >= ROW_CAP ? entries.length : undefined,
        },
      ],
      notes: ["Positive balance = customer owes; negative = advance held."],
    }
  },
}

// ───────────── Supplier data ─────────────

const supplierReport: ReportDef = {
  slug: "suppliers",
  title: "Supplier data",
  description: "Every supplier with LC and purchase volume, goods received, payments and outstanding payable.",
  group: "Customers & suppliers",
  icon: Factory,
  perm: ["reports.financial", "reports.stock"],
  date: "range",
  defaultRange: "this_year",
  landscape: true,
  filters: [
    {
      key: "status",
      label: "Status",
      kind: "select",
      default: "active",
      allLabel: "All suppliers",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "payable", label: "With payable" },
      ],
    },
  ],
  run: async (r) => {
    const status = r.value("status")
    const b = inList(r.branchIds)
    const [suppliers, lcs, pos, grn, pays, ledger] = await Promise.all([
      query<{ id: string; code: string; name: string; country: string | null; currency: string; phone: string | null; contactPerson: string | null; balance: unknown }>(
        sql`SELECT id, code, name, country, currency, phone, contactPerson, balance FROM suppliers WHERE companyId = ${r.companyId}
          ${status === "payable" ? sql`AND balance <> 0` : status ? sql`AND status = ${status}` : empty} ORDER BY name LIMIT ${ROW_CAP}`,
      ),
      query<{ k: string; n: bigint; v: unknown }>(
        sql`SELECT supplierId AS k, COUNT(*) AS n, SUM(lcValue * exchangeRate) AS v FROM lcs
          WHERE companyId = ${r.companyId} AND branchId IN (${b}) AND status <> 'draft'
            AND COALESCE(openedDate, DATE(createdAt)) BETWEEN ${r.from} AND ${r.to} GROUP BY supplierId`,
      ),
      query<{ k: string; n: bigint; v: unknown }>(
        sql`SELECT supplierId AS k, COUNT(*) AS n, SUM(totalBdt) AS v FROM purchase_orders
          WHERE companyId = ${r.companyId} AND branchId IN (${b}) AND status <> 'cancelled' AND orderDate BETWEEN ${r.from} AND ${r.to} GROUP BY supplierId`,
      ),
      query<{ k: string; v: unknown }>(
        sql`SELECT COALESCE(po.supplierId, l.supplierId) AS k, SUM(gl.quantity * gl.unitCost) AS v
          FROM goods_receipt_lines gl JOIN goods_receipts g ON g.id = gl.receiptId
          LEFT JOIN purchase_orders po ON po.id = g.poId LEFT JOIN lcs l ON l.id = g.lcId
          WHERE g.companyId = ${r.companyId} AND g.branchId IN (${b}) AND g.date BETWEEN ${r.from} AND ${r.to} GROUP BY 1`,
      ),
      query<{ k: string; v: unknown }>(
        sql`SELECT supplierId AS k, SUM(amount) AS v FROM supplier_payments
          WHERE companyId = ${r.companyId} AND branchId IN (${b}) AND date BETWEEN ${r.start} AND ${r.end} GROUP BY supplierId`,
      ),
      query<{ k: string; cr: unknown }>(
        sql`SELECT supplierId AS k, SUM(credit) AS cr FROM supplier_ledger_entries
          WHERE companyId = ${r.companyId} AND type <> 'opening' AND date BETWEEN ${r.start} AND ${r.end} GROUP BY supplierId`,
      ),
    ])
    const m = <T extends { k: string }>(rows: T[]) => new Map(rows.map((x) => [x.k, x]))
    const [lm, pm, gm, paym, lgm] = [m(lcs), m(pos), m(grn), m(pays), m(ledger)]
    const rows: ReportRow[] = suppliers.map((s) => ({
      code: s.code,
      name: s.name,
      country: s.country ?? "—",
      currency: s.currency,
      contact: [s.contactPerson, s.phone].filter(Boolean).join(" · ") || "—",
      lcs: toNum(lm.get(s.id)?.n),
      lcValue: num(dec(lm.get(s.id)?.v as string).toDecimalPlaces(2)),
      poValue: toNum(pm.get(s.id)?.v),
      received: num(dec(gm.get(s.id)?.v as string).toDecimalPlaces(2)),
      billed: toNum(lgm.get(s.id)?.cr),
      paid: toNum(paym.get(s.id)?.v),
      outstanding: toNum(s.balance),
    }))
    const columns: ReportColumn[] = [
      { key: "code", label: "Code" },
      { key: "name", label: "Supplier" },
      { key: "country", label: "Country" },
      { key: "currency", label: "Currency" },
      { key: "contact", label: "Contact" },
      { key: "lcs", label: "LCs", type: "int", total: true },
      { key: "lcValue", label: "LC value (BDT)", type: "money", total: true },
      { key: "poValue", label: "PO value", type: "money", total: true },
      { key: "received", label: "Goods received", type: "money", total: true },
      { key: "billed", label: "Payable added", type: "money", total: true },
      { key: "paid", label: "Payments", type: "money", total: true },
      { key: "outstanding", label: "Outstanding", type: "money", total: true, tone: "positive-bad" },
    ]
    const totals = computeTotals(columns, rows)
    const top = [...rows].sort((a, b) => Number(b.outstanding) - Number(a.outstanding)).filter((x) => Number(x.outstanding) > 0)
    return {
      summary: [
        { label: "Suppliers", value: rows.length, type: "int" },
        { label: "Purchase volume", value: num(dec(totals?.lcValue as number).plus(dec(totals?.poValue as number))), type: "money", hint: "LC base value + purchase orders" },
        { label: "Payments", value: Number(totals?.paid ?? 0), type: "money" },
        { label: "Outstanding payable", value: Number(totals?.outstanding ?? 0), type: "money", tone: Number(totals?.outstanding ?? 0) > 0 ? "warning" : "default" },
      ],
      chart: top.length > 1 ? { kind: "hbar", xKey: "name", series: [{ key: "outstanding", label: "Outstanding" }], data: top.slice(0, 10), valueType: "money" } : null,
      tables: [{ key: "suppliers", columns, rows, totals, empty: "No suppliers match these filters." }],
      notes: [
        "Activity columns cover the selected period and branches; outstanding is the current payable balance from the supplier ledger.",
      ],
    }
  },
}

export const PARTY_REPORTS: ReportDef[] = [customerOutstanding, customerLedger, supplierReport]
