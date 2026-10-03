"use client"

import { createContext, useContext, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Ctx = { pending: boolean; set: (patch: Record<string, string | null | undefined>) => void; sp: URLSearchParams }
const ReportQuery = createContext<Ctx | null>(null)

/** Shares one URL-update transition between the filter bar and the report body (dims stale results). */
export function ReportShell({ filters, children }: { filters: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [pending, start] = useTransition()
  const set: Ctx["set"] = (patch) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k)
      else next.set(k, v)
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }))
  }
  return (
    <ReportQuery.Provider value={{ pending, set, sp: new URLSearchParams(sp.toString()) }}>
      {filters}
      <div className={cn("relative space-y-6 transition-opacity", pending && "pointer-events-none opacity-55")} aria-busy={pending}>
        {pending && (
          <div className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs shadow-sm">
            <Loader2 className="size-3.5 animate-spin" /> Updating report…
          </div>
        )}
        {children}
      </div>
    </ReportQuery.Provider>
  )
}

export function useReportQuery() {
  const v = useContext(ReportQuery)
  if (!v) throw new Error("useReportQuery must be used inside ReportShell")
  return v
}
