"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { compactMoney, money } from "@/lib/format"

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
}

/** MRR per month from paid invoices (yearly invoices spread over 12 months). */
export function MrrChart({ data }: { data: { month: string; mrr: number }[] }) {
  const empty = data.every((d) => d.mrr === 0)
  return (
    <div className="h-64">
      {empty ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">No paid invoices in the last 12 months yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
            <YAxis tickFormatter={(v) => compactMoney(v)} tickLine={false} axisLine={false} fontSize={11} width={72} stroke="var(--muted-foreground)" />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
              labelFormatter={(l) => monthLabel(String(l))}
              formatter={(v) => [money(Number(v)), "MRR"]}
            />
            <Bar dataKey="mrr" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

/** Current subscriptions per plan: paying vs trialing vs lapsed/cancelled. */
export function PlanDistribution({ rows }: { rows: { plan: string; paying: number; trialing: number; other: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.paying + r.trialing + r.other))
  if (!rows.length) return <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {rows.map((r) => {
          const total = r.paying + r.trialing + r.other
          return (
            <li key={r.plan}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{r.plan}</span>
                <span className="num text-muted-foreground">{total}</span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-muted" style={{ width: `${Math.max(8, (total / max) * 100)}%` }}>
                {r.paying > 0 && <span className="h-full bg-chart-1" style={{ flex: r.paying }} title={`${r.paying} paying`} />}
                {r.trialing > 0 && <span className="h-full bg-chart-2" style={{ flex: r.trialing }} title={`${r.trialing} trialing`} />}
                {r.other > 0 && <span className="h-full bg-muted-foreground/40" style={{ flex: r.other }} title={`${r.other} lapsed / cancelled`} />}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-1" /> Paying
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-chart-2" /> Trialing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted-foreground/40" /> Lapsed / cancelled
        </span>
      </div>
    </div>
  )
}
