"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { quantity } from "@/lib/format"
import type { ReportChart } from "@/server/modules/reports/types"
import { formatCell } from "./format-cell"

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
const tick = { fontSize: 11, fill: "var(--muted-foreground)" }
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
}

/** Short axis labels: ৳2.6Cr, ৳2.6L, ৳65K. */
function axisMoney(v: number) {
  const a = Math.abs(v)
  const f = (n: number, u: string) => `${v < 0 ? "-" : ""}৳${Number(n.toFixed(n >= 100 ? 0 : 1))}${u}`
  if (a >= 1e7) return f(a / 1e7, "Cr")
  if (a >= 1e5) return f(a / 1e5, "L")
  if (a >= 1e3) return f(a / 1e3, "K")
  return f(a, "")
}

export function ReportChartView({ chart }: { chart: ReportChart }) {
  const fmtAxis = (v: number) => (chart.valueType === "money" ? axisMoney(v) : quantity(v))
  const fmtTip = (v: unknown) => formatCell(chart.valueType ?? "money", Number(v))
  const hasData = chart.data.some((d) => chart.series.some((s) => Number(d[s.key] ?? 0) !== 0))
  const multi = chart.series.length > 1

  return (
    <section className="rounded-xl border bg-card p-4">
      {chart.title && <h2 className="mb-2 text-sm font-semibold">{chart.title}</h2>}
      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Nothing to chart for these filters.</div>
      ) : chart.kind === "hbar" ? (
        <div style={{ height: Math.max(180, chart.data.length * 32 + 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={tick} tickFormatter={fmtAxis} />
              <YAxis
                type="category"
                dataKey={chart.xKey}
                width={150}
                tickLine={false}
                axisLine={false}
                tick={tick}
                tickFormatter={(v: string) => (String(v).length > 22 ? `${String(v).slice(0, 21)}…` : String(v))}
              />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} contentStyle={tooltipStyle} formatter={(v) => fmtTip(v)} />
              {multi && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
              {chart.series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            {chart.kind === "bar" ? (
              <BarChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} minTickGap={16} tick={tick} />
                <YAxis width={64} tickLine={false} axisLine={false} tick={tick} tickFormatter={fmtAxis} />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} contentStyle={tooltipStyle} formatter={(v) => fmtTip(v)} />
                {multi && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
                {chart.series.map((s, i) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                ))}
              </BarChart>
            ) : chart.kind === "line" ? (
              <LineChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} minTickGap={16} tick={tick} />
                <YAxis width={64} tickLine={false} axisLine={false} tick={tick} tickFormatter={fmtAxis} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTip(v)} />
                {multi && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
                {chart.series.map((s, i) => (
                  <Line key={s.key} dataKey={s.key} name={s.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} type="monotone" />
                ))}
              </LineChart>
            ) : (
              <AreaChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey={chart.xKey} tickLine={false} axisLine={false} minTickGap={16} tick={tick} />
                <YAxis width={64} tickLine={false} axisLine={false} tick={tick} tickFormatter={fmtAxis} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTip(v)} />
                {multi && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
                {chart.series.map((s, i) => (
                  <Area
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.12}
                    strokeWidth={2}
                    type="monotone"
                  />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
