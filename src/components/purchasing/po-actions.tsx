"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Ban, Loader2, PackageCheck, Pencil } from "lucide-react"
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
import { useCan } from "@/components/app/app-context"
import { api, errorMessage } from "@/lib/api-client"

export function PoActions({ po }: { po: { id: string; number: string; status: string; editable: boolean; partial: boolean } }) {
  const router = useRouter()
  const canUpdate = useCan("purchase.update")
  const canReceive = useCan("purchase.receive")
  const [confirm, setConfirm] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const open = po.status === "pending" || po.status === "partially_received"

  const cancel = async () => {
    setBusy(true)
    try {
      await api.post(`/api/v1/purchase-orders/${po.id}/cancel`, { reason })
      toast.success(po.partial ? "Remaining quantity cancelled" : `${po.number} cancelled`)
      setConfirm(false)
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {canUpdate && open && (
        <Button variant="outline" onClick={() => setConfirm(true)}>
          <Ban /> {po.partial ? "Cancel remainder" : "Cancel order"}
        </Button>
      )}
      {canUpdate && po.editable && (
        <Button variant="outline" asChild>
          <Link href={`/app/purchases/${po.id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {canReceive && open && (
        <Button asChild>
          <Link href={`/app/purchases/receipts/new?poId=${po.id}`}>
            <PackageCheck /> Receive goods
          </Link>
        </Button>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{po.partial ? `Cancel the rest of ${po.number}?` : `Cancel ${po.number}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {po.partial
                ? "Goods already received stay in stock. Quantities not yet received are cancelled and the order is closed."
                : "Nothing has been received on this order. It will be closed and can no longer be received or edited."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={255} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                cancel()
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy && <Loader2 className="animate-spin" />} {po.partial ? "Cancel remainder" : "Cancel order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
