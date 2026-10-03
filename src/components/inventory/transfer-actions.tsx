"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2, PackageCheck } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api-client"

export function TransferActions({
  t,
}: {
  t: { id: string; number: string; fromName: string; toName: string; canReceive: boolean; canCancel: boolean }
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<"receive" | "cancel" | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [idemKey] = useState(() => crypto.randomUUID())

  const run = async () => {
    setBusy(true)
    try {
      if (dialog === "receive") {
        await api.post(`/api/v1/stock-transfers/${t.id}/receive`, {}, { idempotencyKey: idemKey })
        toast.success(`${t.number} received at ${t.toName}`)
      } else {
        await api.post(`/api/v1/stock-transfers/${t.id}/cancel`, { reason })
        toast.success(`${t.number} cancelled — stock returned to ${t.fromName}`)
      }
      setDialog(null)
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!t.canReceive && !t.canCancel) return null
  return (
    <>
      {t.canCancel && (
        <Button variant="outline" onClick={() => setDialog("cancel")}>
          <Ban /> Cancel transfer
        </Button>
      )}
      {t.canReceive && (
        <Button onClick={() => setDialog("receive")}>
          <PackageCheck /> Receive at {t.toName}
        </Button>
      )}
      <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog === "receive" ? `Receive ${t.number}?` : `Cancel ${t.number}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "receive"
                ? `Confirm the goods have arrived at ${t.toName}. They become available for sale there at the dispatched cost.`
                : `The goods go back into ${t.fromName}'s stock at the dispatched cost. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialog === "cancel" && <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={200} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                run()
              }}
              disabled={busy}
              className={dialog === "cancel" ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            >
              {busy && <Loader2 className="animate-spin" />} {dialog === "receive" ? "Confirm receipt" : "Cancel transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
