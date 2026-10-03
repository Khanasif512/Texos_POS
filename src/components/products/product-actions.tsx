"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCan } from "@/components/app/app-context"
import { api, errorMessage } from "@/lib/api-client"

function ConfirmDelete({
  open,
  onOpenChange,
  title,
  text,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  text: string
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
                onOpenChange(false)
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Header actions on the product detail page. */
export function ProductActions({ id, name, deletable }: { id: string; name: string; deletable: boolean }) {
  const router = useRouter()
  const canUpdate = useCan("inventory.update")
  const canDelete = useCan("inventory.delete")
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      {canDelete && (
        <Button
          variant="outline"
          onClick={() => (deletable ? setConfirm(true) : toast.error("This product has stock or history. Edit it and set it to inactive instead."))}
        >
          <Trash2 /> Delete
        </Button>
      )}
      {canUpdate && (
        <Button asChild>
          <Link href={`/app/products/${id}/edit`}>
            <Pencil /> Edit product
          </Link>
        </Button>
      )}
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${name}?`}
        text="The product and all its variations will be removed. This cannot be undone."
        onConfirm={async () => {
          try {
            await api.delete(`/api/v1/products/${id}`)
            toast.success("Product deleted")
            router.push("/app/products")
            router.refresh()
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </>
  )
}

/** Per-variation menu: activate/deactivate, delete (only without history). */
export function VariationMenu({ id, name, status, lock, isLast }: { id: string; name: string; status: string; lock: string | null; isLast: boolean }) {
  const router = useRouter()
  const canUpdate = useCan("inventory.update")
  const canDelete = useCan("inventory.delete")
  const [confirm, setConfirm] = useState(false)
  if (!canUpdate && !canDelete) return null
  const toggle = async () => {
    try {
      await api.patch(`/api/v1/variations/${id}`, { status: status === "active" ? "inactive" : "active" })
      toast.success(status === "active" ? `${name} deactivated` : `${name} activated`)
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canUpdate && (
            <DropdownMenuItem onSelect={toggle}>
              <Power /> {status === "active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              disabled={!!lock || isLast}
              onSelect={() => setConfirm(true)}
              title={lock ? `This variation ${lock}` : isLast ? "A product needs at least one variation" : undefined}
            >
              <Trash2 /> Delete{lock ? " (has history)" : ""}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDelete
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete variation ${name}?`}
        text="It has no stock or history, so it can be removed completely."
        onConfirm={async () => {
          try {
            await api.delete(`/api/v1/variations/${id}`)
            toast.success("Variation deleted")
            router.refresh()
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </>
  )
}
