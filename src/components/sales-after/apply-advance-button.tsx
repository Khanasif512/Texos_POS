"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, WalletCards } from "lucide-react"
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
import { useCan } from "@/components/app/app-context"
import { api, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"

/** Allocate a customer's unapplied advance receipts to their open invoices (oldest first). */
export function ApplyAdvanceButton({
  customerId,
  amount,
  totalDue,
  onApplied,
  size = "sm",
  variant = "outline",
}: {
  customerId: string
  amount: number
  totalDue?: number
  onApplied?: () => void
  size?: "sm" | "default"
  variant?: "outline" | "default" | "secondary"
}) {
  const allowed = useCan("sales.receipt")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState(() => crypto.randomUUID())
  if (!allowed || amount <= 0) return null
  const applies = totalDue == null ? amount : Math.min(amount, totalDue)

  const apply = async () => {
    setBusy(true)
    try {
      const r = await api.post<{ applied: number; invoices: number }>("/api/v1/receipts/apply-advance", { customerId }, { idempotencyKey: key })
      toast.success(`Applied ${money(r.applied)} to ${r.invoices} invoice${r.invoices === 1 ? "" : "s"}`)
      setKey(crypto.randomUUID())
      setOpen(false)
      onApplied?.()
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <WalletCards /> Apply advance
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply advance to open invoices?</AlertDialogTitle>
            <AlertDialogDescription>
              {money(applies)} of the customer&apos;s {money(amount)} unapplied advance will settle their open invoices, oldest first. The customer
              ledger balance does not change — the advance was already credited when it was received.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                apply()
              }}
              disabled={busy}
            >
              {busy && <Loader2 className="animate-spin" />}
              Apply advance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
