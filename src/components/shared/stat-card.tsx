import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "default" | "success" | "danger" | "warning"
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-2 text-2xl font-semibold tracking-tight",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
