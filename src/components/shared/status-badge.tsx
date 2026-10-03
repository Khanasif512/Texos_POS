import { cn } from "@/lib/utils"

const TONES = {
  success: "bg-success/12 text-success ring-success/20",
  warning: "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_25%)] ring-warning/25 dark:text-warning",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-info/12 text-info ring-info/20",
  neutral: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary/10 text-primary ring-primary/20",
} as const

export type Tone = keyof typeof TONES

export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  )
}

export function ActiveBadge({ status }: { status: string }) {
  return <StatusBadge tone={status === "active" ? "success" : "neutral"}>{status === "active" ? "Active" : "Inactive"}</StatusBadge>
}
