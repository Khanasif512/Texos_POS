import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { balanceState } from "@/lib/validation/customers"

/** Customer balance: positive = due (red), negative = advance (green), zero = settled. */
export function CustomerBalance({ value, className }: { value: number; className?: string }) {
  const s = balanceState(value)
  if (s.kind === "settled") return <span className={cn("num text-muted-foreground", className)}>{money(0)}</span>
  return (
    <span className={cn("num font-medium whitespace-nowrap", s.kind === "due" ? "text-destructive" : "text-success", className)}>
      {money(s.amount)}
      {s.kind === "advance" && <span className="ml-1 text-[11px] font-normal">Advance</span>}
    </span>
  )
}
