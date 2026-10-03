"use client"

import { CalendarRange, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp } from "@/components/app/app-context"
import { CustomerPicker, LcPicker, SupplierPicker, type CustomerOption, type LcOption, type SupplierOption } from "@/components/shared/pickers"
import { cn } from "@/lib/utils"
import type { DateMode, QuickRange, ResolvedFilter } from "@/server/modules/reports/types"
import { useReportQuery } from "./report-shell"

/** Filter bar bound to the URL: date range / as-of date, quick ranges, branch and report-specific filters. */
export function ReportFilters({
  dateMode,
  from,
  to,
  presets,
  showBranch,
  filters,
}: {
  dateMode: DateMode
  from: string
  to: string
  presets: QuickRange[]
  showBranch: boolean
  filters: ResolvedFilter[]
}) {
  const { set, sp } = useReportQuery()
  const app = useApp()
  const segments = filters.filter((f) => f.kind === "segment")
  const others = filters.filter((f) => f.kind !== "segment")
  const activePreset = presets.find((p) => p.from === from && p.to === to)?.key
  const hasCustom = others.some((f) => (f.kind === "select" ? sp.has(f.key) : "value" in f && !!f.value)) || sp.has("branchId")

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      {segments.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {segments.map((f) =>
            f.kind === "segment" ? (
              <div key={f.key} role="radiogroup" aria-label={f.label} className="flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5">
                {f.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={f.value === o.value}
                    onClick={() => set({ [f.key]: o.value })}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                      f.value === o.value && "bg-background text-foreground shadow-sm",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : null,
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {dateMode === "range" && (
          <>
            <div className="flex items-center gap-1.5">
              <Input type="date" className="h-9 w-[146px]" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} aria-label="From date" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" className="h-9 w-[146px]" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} aria-label="To date" />
            </div>
            <Select value={activePreset ?? "custom"} onValueChange={(k) => {
              const p = presets.find((x) => x.key === k)
              if (p) set({ from: p.from, to: p.to })
            }}>
              <SelectTrigger className="h-9 w-[164px]" aria-label="Quick range">
                <CalendarRange className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Quick range" />
              </SelectTrigger>
              <SelectContent>
                {!activePreset && <SelectItem value="custom">Custom range</SelectItem>}
                {presets.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {dateMode === "asOf" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">As of</span>
            <Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => e.target.value && set({ to: e.target.value })} aria-label="As of date" />
          </div>
        )}

        {showBranch && app.branches.length > 1 && (
          <Select value={sp.get("branchId") ?? "all"} onValueChange={(v) => set({ branchId: v === "all" ? null : v })}>
            <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label="Branch">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {app.branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {others.map((f) => {
          if (f.kind === "select")
            return (
              <Select
                key={f.key}
                value={f.value ?? "all"}
                onValueChange={(v) => set({ [f.key]: v === "all" ? (f.hasDefault ? "all" : null) : v })}
              >
                <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label={f.label}>
                  <SelectValue placeholder={f.allLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{f.allLabel}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          if (f.kind === "customer")
            return (
              <div key={f.key} className="w-full sm:w-[240px]">
                <CustomerPicker
                  value={f.value ? ({ id: f.value.id, name: f.value.label, phone: null } as CustomerOption) : null}
                  onChange={(v) => set({ [f.key]: v?.id ?? null })}
                  placeholder={f.required ? "Choose a customer…" : "All customers"}
                />
              </div>
            )
          if (f.kind === "supplier")
            return (
              <div key={f.key} className="w-full sm:w-[220px]">
                <SupplierPicker
                  value={f.value ? ({ id: f.value.id, name: f.value.label } as SupplierOption) : null}
                  onChange={(v) => set({ [f.key]: v?.id ?? null })}
                  placeholder="All suppliers"
                />
              </div>
            )
          if (f.kind === "lc")
            return (
              <div key={f.key} className="w-full sm:w-[200px]">
                <LcPicker
                  value={f.value ? ({ id: f.value.id, lcNumber: f.value.label } as LcOption) : null}
                  onChange={(v) => set({ [f.key]: v?.id ?? null })}
                  placeholder="All LCs"
                />
              </div>
            )
          return null
        })}

        {hasCustom && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => set(Object.fromEntries([...others.map((f) => [f.key, null]), ["branchId", null]]))}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
