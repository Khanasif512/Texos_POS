"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, CalendarPlus, LifeBuoy, Loader2, PlayCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/shared/field"
import { api, errorMessage } from "@/lib/api-client"

export function TenantActions({
  companyId,
  status,
  currentPlanId,
  plans,
}: {
  companyId: string
  status: string
  currentPlanId: string | null
  plans: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [days, setDays] = useState("14")
  const [planId, setPlanId] = useState(currentPlanId ?? "")
  const [activate, setActivate] = useState(true)
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly")

  const run = async (key: string, body: object, after?: (r: { redirect?: string }) => void) => {
    setBusy(key)
    try {
      const r = await api.post<{ redirect?: string }>(`/api/v1/admin/companies/${companyId}`, body)
      toast.success("Done")
      if (after) after(r)
      else router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const spin = (k: string) => busy === k && <Loader2 className="animate-spin" />

  return (
    <aside className="space-y-4">
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Subscription</h3>
        <Field label="Plan">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex items-center justify-between text-sm">
          Activate as paid now
          <Switch checked={activate} onCheckedChange={setActivate} />
        </label>
        {activate && (
          <Select value={cycle} onValueChange={(v) => setCycle(v as "monthly")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button className="w-full" disabled={!planId || !!busy} onClick={() => run("plan", { action: "change_plan", planId, activate, cycle })}>
          {spin("plan")} Apply plan
        </Button>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Trial</h3>
        <div className="flex gap-2">
          <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="w-24" />
          <Button variant="outline" className="flex-1" disabled={!!busy} onClick={() => run("trial", { action: "extend_trial", days: Number(days) })}>
            {spin("trial") || <CalendarPlus />} Extend trial
          </Button>
        </div>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Access</h3>
        {status === "suspended" ? (
          <Button variant="outline" className="w-full" disabled={!!busy} onClick={() => run("status", { action: "reactivate" })}>
            {spin("status") || <PlayCircle />} Reactivate company
          </Button>
        ) : (
          <Button variant="destructive" className="w-full" disabled={!!busy} onClick={() => confirm("Suspend this company? All users will be signed out.") && run("status", { action: "suspend" })}>
            {spin("status") || <Ban />} Suspend company
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          disabled={!!busy}
          onClick={() => run("imp", { action: "impersonate" }, () => window.open("/app", "_blank"))}
        >
          {spin("imp") || <LifeBuoy />} Open as support (audited)
        </Button>
      </section>
    </aside>
  )
}
