"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Ban, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"
import { cancelInvoiceSchema, type CancelInvoiceInput, type CancelInvoiceOutput } from "@/lib/validation/sales"

/** SLS-05: cancel with a reason. Disabled (with the reason shown) when the server rules would refuse it. */
export function CancelInvoiceButton({
  id,
  number,
  total,
  paid,
  blockers,
}: {
  id: string
  number: string
  total: number
  paid: number
  blockers: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, formState, setError, reset } = useForm<CancelInvoiceInput, unknown, CancelInvoiceOutput>({
    resolver: zodResolver(cancelInvoiceSchema),
    defaultValues: { reason: "" },
  })
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.post(`/api/v1/invoices/${id}/cancel`, v)
      toast.success(`Invoice ${number} cancelled`)
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  const blocked = blockers.length > 0
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={blocked} title={blocked ? blockers.join(" · ") : undefined}>
        <Ban /> Cancel invoice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel invoice {number}?</DialogTitle>
            <DialogDescription>
              Stock goes back to the original batches and the customer ledger is reversed
              {paid > 0 ? ` — ${money(paid)} paid must be refunded to the customer` : ""}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form id="cancel-invoice" onSubmit={onSubmit} noValidate>
            <Field label="Reason" htmlFor="cancel-reason" error={formState.errors.reason?.message} required hint={`Invoice total ${money(total)}`}>
              <Textarea id="cancel-reason" rows={3} autoFocus placeholder="e.g. Customer changed the order before delivery" {...register("reason")} />
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep invoice
            </Button>
            <Button type="submit" form="cancel-invoice" variant="destructive" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />}
              Cancel invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
