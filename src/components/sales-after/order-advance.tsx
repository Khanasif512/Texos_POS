"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/shared/field"
import { ApiError, api, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/validation/sales-after"

/** Take an advance on an open sales order (advance money receipt, customer ledger credit). */
export function OrderAdvanceButton({ orderId, number, total, taken }: { orderId: string; number: string; total: number; taken: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [reference, setReference] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState(() => crypto.randomUUID())

  const submit = async () => {
    if (!(Number(amount) > 0)) return setError("Enter the advance amount")
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<{ receipt: { id: string; number: string } }>(`/api/v1/sales-orders/${orderId}/advance`, { amount: Number(amount), method, reference }, { idempotencyKey: key })
      toast.success(`Advance receipt ${r.receipt.number} saved`)
      setKey(crypto.randomUUID())
      setAmount("")
      setOpen(false)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields?.amount) setError(err.details.fields.amount)
      else toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Wallet /> Take advance
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Advance on {number}</DialogTitle>
            <DialogDescription>
              Order total {money(total)}
              {taken > 0 && `, ${money(taken)} already taken`}. The advance is credited to the customer and can be applied to the invoice once the order is converted.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Amount" htmlFor="adv-amount" error={error ?? undefined} required>
              <Input id="adv-amount" type="number" inputMode="decimal" min="0" step="0.01" className="num" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Method">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference" htmlFor="adv-ref">
                <Input id="adv-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Save advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
