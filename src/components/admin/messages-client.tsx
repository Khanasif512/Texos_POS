"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, Inbox, Loader2, Mail, Phone, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errorMessage } from "@/lib/api-client"
import { dateTime } from "@/lib/format"

type Row = { id: string; name: string; email: string; phone: string | null; company: string | null; message: string; handled: boolean; createdAt: string }

export function MessagesClient({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const [view, setView] = useState<"open" | "handled" | "all">("open")
  const [busy, setBusy] = useState<string | null>(null)
  const visible = rows.filter((r) => (view === "all" ? true : view === "open" ? !r.handled : r.handled))

  const toggle = async (r: Row) => {
    setBusy(r.id)
    try {
      await api.post(`/api/v1/admin/messages/${r.id}`, { handled: !r.handled })
      toast.success(r.handled ? "Reopened" : "Marked handled")
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as "open")}>
        <TabsList>
          <TabsTrigger value="open">Open ({rows.filter((r) => !r.handled).length})</TabsTrigger>
          <TabsTrigger value="handled">Handled</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {visible.length === 0 ? (
        <EmptyState icon={Inbox} title={view === "open" ? "Inbox zero" : "No messages"} text={view === "open" ? "Every contact message has been handled." : "Messages from the contact form appear here."} />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.name}
                    {r.company && <span className="font-normal text-muted-foreground"> · {r.company}</span>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Mail className="size-3.5" /> {r.email}
                    </a>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="num inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="size-3.5" /> {r.phone}
                      </a>
                    )}
                    <span>{dateTime(r.createdAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.handled && <StatusBadge tone="success">Handled</StatusBadge>}
                  <Button size="sm" variant={r.handled ? "ghost" : "outline"} onClick={() => toggle(r)} disabled={busy === r.id}>
                    {busy === r.id ? <Loader2 className="animate-spin" /> : r.handled ? <RotateCcw /> : <CheckCheck />} {r.handled ? "Reopen" : "Mark handled"}
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
