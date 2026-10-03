"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"

/** Approve a pending return: stock, invoice and ledger post in one transaction on the server. */
export function ApproveReturnButton({
  id,
  number,
  amount,
  refundMode,
  restock,
  customerName,
  invoiceDue,
}: {
  id: string
  number: string
  amount: number
  refundMode: string
  restock: boolean
  customerName: string
  invoiceDue: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [key] = useState(() => crypto.randomUUID())
  const cn = refundMode === "credit_note"
  const dueCut = Math.min(amount, Math.max(invoiceDue, 0))

  const approve = async () => {
    setBusy(true)
    try {
      const r = await api.post<{ creditNote: { number: string } | null; totalAmount: number }>(`/api/v1/returns/${id}/approve`, {}, { idempotencyKey: key })
      toast.success(r.creditNote ? `Approved — credit note ${r.creditNote.number} issued` : `Approved — refund ${money(r.totalAmount)} in cash`)
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CheckCircle2 /> Approve
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve return {number}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>{restock ? "Items go back into stock (to the batches they were sold from)." : "Items are written off — stock is not restored."}</li>
                {cn ? (
                  <li>
                    A credit note of about {money(amount)} is issued to {customerName}
                    {dueCut > 0 ? `; ${money(dueCut)} comes off the invoice due.` : " as account credit."}
                  </li>
                ) : (
                  <li>Pay {money(amount)} back in cash from the counter — it shows in today&apos;s cash closing.</li>
                )}
                <li>This cannot be undone.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                approve()
              }}
            >
              {busy && <Loader2 className="animate-spin" />}
              Approve return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
