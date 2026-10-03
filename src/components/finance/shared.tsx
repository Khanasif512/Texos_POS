"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge, type Tone } from "@/components/shared/status-badge"
import { useApp } from "@/components/app/app-context"
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethodKey } from "@/lib/validation/finance"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Local calendar day as yyyy-mm-dd (business day of the browser). */
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** "2026-10-03" → Date at local noon (safe for date-only formatting). */
export const dayDate = (key: string) => new Date(`${key}T12:00:00`)

export const methodLabel = (m: string) => PAYMENT_METHOD_LABELS[m as PaymentMethodKey] ?? m

const METHOD_TONE: Record<string, Tone> = { cash: "success", bank: "info", mobile_banking: "primary", card: "neutral", cheque: "warning" }

export function MethodBadge({ method }: { method: string }) {
  return <StatusBadge tone={METHOD_TONE[method] ?? "neutral"}>{methodLabel(method)}</StatusBadge>
}

export function MethodSelect({ value, onChange, id, className }: { value: string; onChange: (v: PaymentMethodKey) => void; id?: string; className?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PaymentMethodKey)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder="Method" />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_METHODS.map((m) => (
          <SelectItem key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Branch select limited to the user's permitted branches. */
export function BranchSelect({ value, onChange, id, className, placeholder = "Choose a branch" }: { value: string; onChange: (v: string) => void; id?: string; className?: string; placeholder?: string }) {
  const { branches } = useApp()
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Signed amount with tone: positive green, negative red. */
export function SignedMoney({ value, className }: { value: number; className?: string }) {
  return <span className={cn("num", value > 0 && "text-success", value < 0 && "text-destructive", className)}>{money(value)}</span>
}

/** A compact summary strip shown above/below lists (totals for the filtered range). */
export function TotalsStrip({ items, className }: { items: { label: string; value: React.ReactNode; hint?: string }[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4", className)}>
      {items.map((i) => (
        <div key={i.label} className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{i.label}</p>
          <p className="num mt-0.5 text-base font-semibold tracking-tight">{i.value}</p>
          {i.hint && <p className="text-[11px] text-muted-foreground">{i.hint}</p>}
        </div>
      ))}
    </div>
  )
}
