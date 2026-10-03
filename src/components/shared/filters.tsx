"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp } from "@/components/app/app-context"
import { useQueryState } from "./server-table"

/** Branch filter bound to ?branchId= (only the user's permitted branches). */
export function BranchFilter({ allowAll = true }: { allowAll?: boolean }) {
  const ctx = useApp()
  const { sp, set } = useQueryState()
  if (ctx.branches.length < 2 && allowAll) return null
  return (
    <Select value={sp.get("branchId") ?? "all"} onValueChange={(v) => set({ branchId: v })}>
      <SelectTrigger className="h-9 w-[180px]">
        <SelectValue placeholder="All branches" />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">All branches</SelectItem>}
        {ctx.branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Date range bound to ?from=&to= (yyyy-mm-dd). */
export function DateRangeFilter() {
  const { sp, set } = useQueryState()
  return (
    <div className="flex items-center gap-1.5">
      <Input type="date" className="h-9 w-[150px]" value={sp.get("from") ?? ""} onChange={(e) => set({ from: e.target.value })} aria-label="From date" />
      <span className="text-xs text-muted-foreground">to</span>
      <Input type="date" className="h-9 w-[150px]" value={sp.get("to") ?? ""} onChange={(e) => set({ to: e.target.value })} aria-label="To date" />
    </div>
  )
}

/** Generic select filter bound to a query key. */
export function SelectFilter({ name, options, placeholder }: { name: string; options: { value: string; label: string }[]; placeholder: string }) {
  const { sp, set } = useQueryState()
  return (
    <Select value={sp.get(name) ?? "all"} onValueChange={(v) => set({ [name]: v })}>
      <SelectTrigger className="h-9 w-[160px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
