"use client"

import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** URL-synced tabs (?tab=) so header links like "Finalize cost" can open the right tab. */
export function LcTabs({ tabs }: { tabs: { value: string; label: string; count?: number; content: React.ReactNode }[] }) {
  const sp = useSearchParams()
  const requested = sp.get("tab")
  const value = tabs.some((t) => t.value === requested) ? requested! : tabs[0].value
  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        const next = new URLSearchParams(sp.toString())
        next.set("tab", v)
        window.history.replaceState(null, "", `?${next.toString()}`)
      }}
      className="gap-4"
    >
      <div className="overflow-x-auto">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-3">
              {t.label}
              {t.count != null && <span className="ml-1 text-xs text-muted-foreground">({t.count})</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
