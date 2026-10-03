"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileMinus, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp, useCan } from "@/components/app/app-context"
import { Field } from "@/components/shared/field"
import { CustomerPicker, type CustomerOption } from "@/components/shared/pickers"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"
import { creditNoteSchema, type CreditNoteInput, type CreditNoteOutput } from "@/lib/validation/sales-after"
import type { CustomerDueSummary } from "@/server/modules/sales-after/receipts"

/** Manual credit note (goodwill / price correction) — perm sales.return_approve. */
export function CreditNoteDialogButton() {
  const allowed = useCan("sales.return_approve")
  const [open, setOpen] = useState(false)
  if (!allowed) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Manual credit note
      </Button>
      {open && <CreditNoteDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function CreditNoteDialog({ onClose }: { onClose: () => void }) {
  const app = useApp()
  const router = useRouter()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [customer, setCustomer] = useState<CustomerOption | null>(null)
  const [summary, setSummary] = useState<CustomerDueSummary | null>(null)
  const { register, handleSubmit, formState, setError, control, setValue } = useForm<CreditNoteInput, unknown, CreditNoteOutput>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: { customerId: "", branchId: app.activeBranchId, invoiceId: "", amount: "" as unknown as number, reason: "", date: format(new Date(), "yyyy-MM-dd") },
  })
  const e = formState.errors

  useEffect(() => {
    if (!customer) return
    let cancelled = false
    api
      .get<CustomerDueSummary>(`/api/v1/receipts/customer-summary?customerId=${customer.id}`)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(null))
    return () => {
      cancelled = true
    }
  }, [customer])

  const onSubmit = handleSubmit(async (v) => {
    try {
      const r = await api.post<{ id: string; number: string; dueReduction: number }>("/api/v1/credit-notes", v, { idempotencyKey })
      toast.success(`Credit note ${r.number} issued`, r.dueReduction > 0 ? { description: `${money(r.dueReduction)} taken off the invoice due` } : undefined)
      onClose()
      router.push(`/app/sales/credit-notes/${r.id}`)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileMinus className="size-4" /> Manual credit note
          </DialogTitle>
          <DialogDescription>Credits the customer&apos;s ledger. Linked to an invoice, it reduces that invoice&apos;s due first.</DialogDescription>
        </DialogHeader>
        <form id="cn-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Customer" error={e.customerId?.message} required>
            <CustomerPicker
              value={customer}
              onChange={(c) => {
                setCustomer(c)
                setSummary(null)
                setValue("customerId", c?.id ?? "", { shouldValidate: !!c })
                setValue("invoiceId", "")
              }}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Against invoice" hint={summary && summary.openInvoices.length === 0 ? "No open invoices" : "Optional"}>
              <Controller
                control={control}
                name="invoiceId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)} disabled={!summary}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No invoice (customer credit)</SelectItem>
                      {summary?.openInvoices.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.number} · due {money(i.dueAmount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Branch" error={e.branchId?.message} required>
              <Controller
                control={control}
                name="branchId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {app.branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" htmlFor="cn-amount" error={e.amount?.message} required>
              <Input id="cn-amount" type="number" inputMode="decimal" step="0.01" min="0" className="num" {...register("amount")} />
            </Field>
            <Field label="Date" htmlFor="cn-date" error={e.date?.message} required>
              <Input id="cn-date" type="date" {...register("date")} />
            </Field>
          </div>
          <Field label="Reason" htmlFor="cn-reason" error={e.reason?.message} required hint="Shown on the credit note and the customer ledger.">
            <Textarea id="cn-reason" rows={2} placeholder="e.g. Price correction on glass panels" {...register("reason")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cn-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Issue credit note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
