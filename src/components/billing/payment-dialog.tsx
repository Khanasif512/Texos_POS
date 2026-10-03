"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, ExternalLink, Landmark, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/shared/field"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { date, money } from "@/lib/format"
import { paymentReferenceSchema, type PaymentReferenceInput, type PaymentReferenceOutput } from "@/lib/validation/billing"

export type PaymentTarget = {
  invoice: { id: string; number: string; amount: number; dueAt: string | Date | null; paymentReference?: string | null }
  checkout: { provider: string; redirectUrl?: string; instructions?: string } | null
}

/** Shows how to pay an invoice (provider instructions or hosted checkout) and collects the "I have paid" reference. */
export function PaymentDialog({ target, onClose }: { target: PaymentTarget; onClose: () => void }) {
  const router = useRouter()
  const { invoice, checkout } = target
  const [copied, setCopied] = useState(false)
  const { register, handleSubmit, formState, setError } = useForm<PaymentReferenceInput, unknown, PaymentReferenceOutput>({
    resolver: zodResolver(paymentReferenceSchema),
    defaultValues: { reference: invoice.paymentReference ?? "" },
  })
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.post(`/api/v1/billing/invoices/${invoice.id}/reference`, v)
      toast.success("Thanks! We'll confirm your payment shortly — usually within one business day.")
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  const copy = async () => {
    await navigator.clipboard.writeText(invoice.number).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="size-4" /> Pay invoice {invoice.number}
          </DialogTitle>
          <DialogDescription>Your plan switches as soon as the payment is confirmed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Amount due</p>
              <p className="num text-lg font-semibold">{money(invoice.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reference to quote</p>
              <button type="button" onClick={copy} className="num mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm font-semibold hover:text-primary">
                {invoice.number} {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </button>
              {invoice.dueAt && <p className="text-xs text-muted-foreground">Due {date(invoice.dueAt)}</p>}
            </div>
          </div>
          {checkout?.redirectUrl ? (
            <Button asChild>
              <a href={checkout.redirectUrl}>
                <ExternalLink /> Continue to secure payment
              </a>
            </Button>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {checkout?.instructions ?? "Payment instructions are not available. Please contact support."}
            </div>
          )}
          <form id="pay-ref-form" onSubmit={onSubmit} noValidate>
            <Field
              label="I have paid — transaction ID / reference"
              htmlFor="reference"
              error={formState.errors.reference?.message}
              hint={invoice.paymentReference ? "You already sent a reference; sending a new one replaces it." : "bKash TrxID or bank transfer reference."}
            >
              <Input id="reference" placeholder="e.g. 9JH4K2LQ7P" autoComplete="off" {...register("reference")} />
            </Field>
          </form>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Pay later
          </Button>
          <Button type="submit" form="pay-ref-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />} I have paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
