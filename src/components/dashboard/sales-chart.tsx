"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { compactMoney, money } from "@/lib/format"

type Point = { date: string; sales: number; profit: number | null }

const short = (key: string) => {
  const d = new Date(`${key}T12:00:00`)
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

/** Sales of the last 30 days (single series, so no legend — the card title names it). */
export function SalesChart({ data }: { data: Point[] }) {
  const empty = data.every((d) => d.sales === 0)
  if (empty)
    return <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">No sales in the last 30 days yet.</div>
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={short}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            width={60}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => compactMoney(v).replace("৳ ", "৳")}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
            labelFormatter={(l) => short(String(l))}
            formatter={(v, name) => [money(Number(v)), name === "sales" ? "Sales" : "Gross profit"]}
          />
          <Area type="monotone" dataKey="sales" stroke="var(--chart-1)" strokeWidth={2} fill="url(#salesFill)" activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
