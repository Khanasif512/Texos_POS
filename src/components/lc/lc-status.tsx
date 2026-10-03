import Link from "next/link"
import { Check, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { date } from "@/lib/format"
import { LC_STATUSES, LC_STATUS_LABEL, LC_STATUS_TONE, lcStatusIndex, type LcStatus } from "@/lib/validation/lc"
import { cn } from "@/lib/utils"

export function LcStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status as LcStatus
  return (
    <StatusBadge tone={LC_STATUS_TONE[s] ?? "neutral"} className={className}>
      {s === "closed" && <Lock className="size-3" />}
      {LC_STATUS_LABEL[s] ?? status}
    </StatusBadge>
  )
}

/** LC-10 progress: Draft → Opened → Goods in transit → Received → Cost finalized → Closed. */
export function LcStepper({
  status,
  dates,
}: {
  status: string
  dates: Partial<Record<LcStatus, string | null>>
}) {
  const at = lcStatusIndex(status)
  return (
    <ol className="grid grid-cols-3 gap-y-4 rounded-xl border bg-card p-4 sm:grid-cols-6">
      {LC_STATUSES.map((s, i) => {
        const done = i < at || (s === "closed" && at === i)
        const current = i === at && s !== "closed"
        return (
          <li key={s} className="relative flex flex-col items-center gap-1.5 text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn("absolute top-3.5 right-1/2 hidden h-px w-full -translate-y-1/2 sm:block", i <= at ? "bg-primary/60" : "bg-border")}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                current && "border-primary bg-background text-primary ring-4 ring-primary/15",
                !done && !current && "bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("text-xs font-medium", !done && !current && "text-muted-foreground")}>{LC_STATUS_LABEL[s]}</span>
            {dates[s] && <span className="text-[11px] text-muted-foreground">{date(dates[s])}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** TEN-03: shown instead of LC pages when the plan does not include the LC module. */
export function LcLocked({ planName }: { planName: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="LC & landed cost is not in your plan"
      text={`Your ${planName} plan does not include LC management and the landed-cost engine. Upgrade to track imports and get true per-unit costs.`}
      action={
        <Button asChild>
          <Link href="/app/settings/billing">View plans</Link>
        </Button>
      }
    />
  )
}
