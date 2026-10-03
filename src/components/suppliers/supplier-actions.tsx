"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Trash2 } from "lucide-react"
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
import { SupplierDialog, type SupplierFormRow } from "./supplier-dialog"

export function SupplierActions({ supplier }: { supplier: SupplierFormRow }) {
  const router = useRouter()
  const canUpdate = useCan("suppliers.update")
  const canDelete = useCan("suppliers.delete")
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      await api.delete(`/api/v1/suppliers/${supplier.id}`)
      toast.success("Supplier deleted")
      router.push("/app/suppliers")
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {canDelete && (
        <Button variant="outline" onClick={() => setConfirm(true)}>
          <Trash2 /> Delete
        </Button>
      )}
      {canUpdate && (
        <Button onClick={() => setEditing(true)}>
          <Pencil /> Edit supplier
        </Button>
      )}
      {editing && <SupplierDialog row={supplier} onClose={() => setEditing(false)} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {supplier.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only suppliers without LCs, purchases or payments can be deleted. Suppliers with history should be marked inactive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                remove()
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy && <Loader2 className="animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
