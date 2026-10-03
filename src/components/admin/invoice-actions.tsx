"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Ban, CheckCircle2, Loader2, MoreHorizontal, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/shared/field"
import { api, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"

export type AdminInvoice = { id: string; number: string; amount: number; status: string; companyName: string; paymentReference: string | null }

/** Row actions for a platform billing invoice: mark paid (activates the plan), mark failed, void. */
export function InvoiceActions({ invoice, compact }: { invoice: AdminInvoice; compact?: boolean }) {
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const open = invoice.status === "unpaid" || invoice.status === "failed"
  if (!open) return null

  const run = async (body: object, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setBusy(true)
    try {
      await api.post(`/api/v1/admin/billing/${invoice.id}`, body)
      toast.success("Invoice updated")
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant={compact ? "outline" : "default"} onClick={() => setPaying(true)} disabled={busy}>
        <CheckCircle2 /> Mark paid
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${invoice.number}`} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {invoice.status === "unpaid" && (
            <DropdownMenuItem onClick={() => run({ action: "mark_failed" }, `Mark ${invoice.number} as failed? The tenant is emailed.`)}>
              <XCircle /> Mark failed
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => run({ action: "void" }, `Void ${invoice.number}? It can no longer be paid.`)}>
            <Ban /> Void invoice
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {paying && <MarkPaidDialog invoice={invoice} onClose={() => setPaying(false)} />}
    </div>
  )
}

function MarkPaidDialog({ invoice, onClose }: { invoice: AdminInvoice; onClose: () => void }) {
  const router = useRouter()
  const [reference, setReference] = useState(invoice.paymentReference ?? "")
  const [paidAt, setPaidAt] = useState(format(new Date(), "yyyy-MM-dd"))
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const r = await api.post<{ activated: { planName: string } | null }>(`/api/v1/admin/billing/${invoice.id}`, { action: "mark_paid", reference, paidAt })
      toast.success(r.activated ? `Paid — ${invoice.companyName} is now on ${r.activated.planName}` : "Marked paid")
      onClose()
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm payment for {invoice.number}</DialogTitle>
          <DialogDescription>
            {invoice.companyName} · <span className="num">{money(invoice.amount)}</span>. If the invoice is for a plan, the subscription is activated on that plan
            immediately and the tenant is emailed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment reference" htmlFor="ref" hint={invoice.paymentReference ? "Submitted by the tenant" : undefined}>
            <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="bKash TrxID / bank ref" />
          </Field>
          <Field label="Received on" htmlFor="paidAt">
            <Input id="paidAt" type="date" value={paidAt} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
