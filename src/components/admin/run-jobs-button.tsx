"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, errorMessage } from "@/lib/api-client"

type Report = {
  checked: number
  trialReminders: number
  trialsExpired: number
  renewalsInvoiced: number
  cancellationsEnded: number
  lapsed: number
  overdueNotices: number
  retentionExpired: number
  errors: unknown[]
}

/** Runs the subscription lifecycle job on demand (it also runs on the hourly schedule). */
export function RunJobsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const r = await api.post<Report>("/api/v1/admin/jobs/run")
      const parts = [
        r.trialReminders && `${r.trialReminders} trial reminders`,
        r.trialsExpired && `${r.trialsExpired} trials expired`,
        r.renewalsInvoiced && `${r.renewalsInvoiced} renewals invoiced`,
        r.cancellationsEnded && `${r.cancellationsEnded} cancellations ended`,
        r.lapsed && `${r.lapsed} lapsed`,
        r.overdueNotices && `${r.overdueNotices} overdue notices`,
        r.retentionExpired && `${r.retentionExpired} retention flags`,
      ].filter(Boolean)
      toast.success(`Checked ${r.checked} subscriptions${parts.length ? `: ${parts.join(", ")}` : " — nothing to do"}`)
      if (r.errors.length) toast.error(`${r.errors.length} subscription(s) failed — see server log`)
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Run lifecycle jobs
    </Button>
  )
}
