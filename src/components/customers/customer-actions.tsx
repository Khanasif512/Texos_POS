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
import { CustomerDialog, type CustomerFormRow } from "./customer-dialog"

export function CustomerActions({ customer }: { customer: CustomerFormRow }) {
  const router = useRouter()
  const canUpdate = useCan("customers.update")
  const canDelete = useCan("customers.delete")
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      await api.delete(`/api/v1/customers/${customer.id}`)
      toast.success("Customer deleted")
      router.push("/app/customers")
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
          <Pencil /> Edit customer
        </Button>
      )}
      {editing && <CustomerDialog row={customer} onClose={() => setEditing(false)} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {customer.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only customers without invoices, payments or other ledger activity can be deleted. Otherwise mark the customer inactive.
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
