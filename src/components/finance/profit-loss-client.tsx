"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BranchFilter } from "@/components/shared/filters"
import { useQueryState } from "@/components/shared/server-table"
import { useApp } from "@/components/app/app-context"
import { compactMoney, date, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { PeriodRow, ResolvedPeriod } from "@/server/modules/finance/calc"
import type { PnlStatement } from "@/server/modules/finance/pnl"
import { SignedMoney, dayDate } from "./shared"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`)
const cents = (v: number) => Math.round(v * 100)

export function ProfitLossClient({
  period,
  statement: s,
  byBranch,
  monthly,
}: {
  period: ResolvedPeriod
  statement: PnlStatement
  byBranch: (PeriodRow & { branchId: string; branchName: string })[]
  monthly: PeriodRow[]
}) {
  const app = useApp()
  const { set, pending } = useQueryState()
  const label =
    period.kind === "day" ? date(dayDate(period.date)) : period.kind === "range" ? `${date(dayDate(period.from))} – ${date(dayDate(period.to))}` : period.label

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
        <Tabs value={period.kind} onValueChange={(v) => set({ period: v })}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="range">Custom range</TabsTrigger>
          </TabsList>
        </Tabs>
        {period.kind === "day" && (
          <Input type="date" className="h-9 w-[160px]" value={period.date} onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label="Day" />
        )}
        {period.kind === "month" && (
          <Input type="month" className="h-9 w-[160px]" value={period.month} onChange={(e) => e.target.value && set({ month: e.target.value })} aria-label="Month" />
        )}
        {period.kind === "range" && (
          <div className="flex items-center gap-1.5">
            <Input type="date" className="h-9 w-[150px]" value={period.from} onChange={(e) => e.target.value && set({ from: e.target.value })} aria-label="From" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" className="h-9 w-[150px]" value={period.to} onChange={(e) => e.target.value && set({ to: e.target.value })} aria-label="To" />
          </div>
        )}
        <BranchFilter />
        <p className="text-sm text-muted-foreground lg:ml-auto">{label}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Net revenue" value={money(s.netRevenue)} hint={`${s.invoiceCount} invoice${s.invoiceCount === 1 ? "" : "s"}`} />
        <Kpi label="Gross profit" value={money(s.grossProfit)} hint={`Margin ${pct(s.grossMargin)}`} />
        <Kpi label="Operating expenses" value={money(s.operatingExpenses)} hint={`${s.expenses.length} categor${s.expenses.length === 1 ? "y" : "ies"}`} />
        <Kpi label="Net profit" value={<SignedMoney value={s.netProfit} />} hint={`Net margin ${pct(s.netMargin)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Statement</h2>
            <p className="text-xs text-muted-foreground">
              {label} · {app.branches.length > 1 ? "selected branches" : app.branches[0]?.name}
            </p>
          </div>
          <dl className="text-sm">
            <Line label="Sales (invoices)" value={s.sales} />
            <Line label="Less: sales returns" value={-s.returns} hint={`${s.returnCount} approved return${s.returnCount === 1 ? "" : "s"}`} muted />
            <Line label="Net revenue" value={s.netRevenue} strong />
            <Line label="Less: cost of goods sold" value={-s.cogs} hint="Snapshotted landed cost, net of returned stock" muted />
            <Line label="Gross profit" value={s.grossProfit} strong extra={`Margin ${pct(s.grossMargin)}`} />
            <div className="border-t px-5 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Operating expenses</div>
            {s.expenses.length === 0 ? (
              <p className="px-5 py-2 text-xs text-muted-foreground">No operating expenses in this period.</p>
            ) : (
              s.expenses.map((e) => <Line key={e.categoryId} label={e.name} value={-e.amount} indent muted border={false} />)
            )}
            <Line label="Total operating expenses" value={-s.operatingExpenses} />
            <div className={cn("flex items-center justify-between gap-4 border-t-2 px-5 py-4", s.netProfit < 0 ? "bg-destructive/5" : "bg-success/5")}>
              <dt className="font-semibold">{s.netProfit < 0 ? "Net loss" : "Net profit"}</dt>
              <dd className="text-right">
                <SignedMoney value={s.netProfit} className="text-lg font-semibold" />
                <p className="text-xs text-muted-foreground">Net margin {pct(s.netMargin)}</p>
              </dd>
            </div>
          </dl>
          {s.lcAllocatedExpenses > 0 && (
            <p className="flex gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0" />
              {money(s.lcAllocatedExpenses)} of expenses in this period were allocated to LCs; they reach the P&amp;L through COGS when the goods sell.
            </p>
          )}
        </section>

        <div className="space-y-6">
          <MonthlyChart year={period.year} rows={monthly} onYear={(y) => set({ year: String(y) })} />
          {byBranch.length > 1 && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">By branch</h2>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs">Branch</TableHead>
                      <TableHead className="text-right text-xs">Net revenue</TableHead>
                      <TableHead className="text-right text-xs">Gross profit</TableHead>
                      <TableHead className="text-right text-xs">Expenses</TableHead>
                      <TableHead className="text-right text-xs">Net profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byBranch.map((b) => (
                      <TableRow key={b.branchId}>
                        <TableCell className="whitespace-nowrap">{b.branchName}</TableCell>
                        <TableCell className="num text-right">{money(b.netRevenue)}</TableCell>
                        <TableCell className="num text-right">{money(b.grossProfit)}</TableCell>
                        <TableCell className="num text-right">{money(b.expenses)}</TableCell>
                        <TableCell className="text-right">
                          <SignedMoney value={b.netProfit} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="num mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Line({
  label,
  value,
  hint,
  extra,
  strong,
  muted,
  indent,
  border = true,
}: {
  label: string
  value: number
  hint?: string
  extra?: string
  strong?: boolean
  muted?: boolean
  indent?: boolean
  border?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 px-5 py-2.5", border && "border-t", strong && "bg-muted/30")}>
      <dt className={cn(indent && "pl-4", strong && "font-semibold")}>
        {label}
        {hint && <p className="text-xs font-normal text-muted-foreground">{hint}</p>}
      </dt>
      <dd className="text-right">
        <span className={cn("num", strong && "font-semibold", muted && value < 0 && "text-muted-foreground")}>
          {value < 0 ? `(${money(-value)})` : money(value)}
        </span>
        {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      </dd>
    </div>
  )
}

function MonthlyChart({ year, rows, onYear }: { year: number; rows: PeriodRow[]; onYear: (y: number) => void }) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const data = rows.map((r) => ({ ...r, month: MONTHS[Number(r.key.slice(5, 7)) - 1] }))
  const sum = (f: (r: PeriodRow) => number) => rows.reduce((a, r) => a + cents(f(r)), 0) / 100
  const thisYear = new Date().getFullYear()
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">Month by month</h2>
          <p className="text-xs text-muted-foreground">Net revenue and net profit, {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-lg border bg-background px-2 text-sm"
            value={year}
            onChange={(e) => onYear(Number(e.target.value))}
            aria-label="Year"
          >
            {Array.from({ length: 5 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Tabs value={view} onValueChange={(v) => setView(v as "chart" | "table")}>
            <TabsList>
              <TabsTrigger value="chart" className="text-xs">
                Chart
              </TabsTrigger>
              <TabsTrigger value="table" className="text-xs">
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      {view === "chart" ? (
        <div className="h-[280px] px-2 pt-4 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => compactMoney(v).replace("৳ ", "৳")}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                formatter={(v, name) => [money(Number(v)), name]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="netRevenue" name="Net revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="netProfit" name="Net profit" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs">Month</TableHead>
                <TableHead className="text-right text-xs">Net revenue</TableHead>
                <TableHead className="text-right text-xs">COGS</TableHead>
                <TableHead className="text-right text-xs">Gross profit</TableHead>
                <TableHead className="text-right text-xs">Expenses</TableHead>
                <TableHead className="text-right text-xs">Net profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.month}</TableCell>
                  <TableCell className="num text-right">{money(r.netRevenue)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{money(r.cogs)}</TableCell>
                  <TableCell className="num text-right">{money(r.grossProfit)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{money(r.expenses)}</TableCell>
                  <TableCell className="text-right">
                    <SignedMoney value={r.netProfit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">{year}</TableCell>
                <TableCell className="num text-right">{money(sum((r) => r.netRevenue))}</TableCell>
                <TableCell className="num text-right">{money(sum((r) => r.cogs))}</TableCell>
                <TableCell className="num text-right">{money(sum((r) => r.grossProfit))}</TableCell>
                <TableCell className="num text-right">{money(sum((r) => r.expenses))}</TableCell>
                <TableCell className="text-right">
                  <SignedMoney value={sum((r) => r.netProfit)} className="font-semibold" />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </section>
  )
}
