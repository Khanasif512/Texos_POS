"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FolderTree, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import { DataTable } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { useCan } from "@/components/app/app-context"
import { api, errorMessage } from "@/lib/api-client"
import { CategoryDialog } from "./category-dialog"

type Row = { id: string; name: string; parentId: string | null; parentName: string | null; products: number; children: number }

export function CategoriesClient({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const canCreate = useCan(["inventory.create", "inventory.update"])
  const canUpdate = useCan("inventory.update")
  const canDelete = useCan("inventory.delete")
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.delete(`/api/v1/categories/${deleting.id}`)
      toast.success("Category deleted")
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          text="Create categories like Aluminium Profiles, Glass or Hardware to organise your products."
          action={
            canCreate && (
              <Button onClick={() => setEditing("new")}>
                <Plus /> Add category
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          searchPlaceholder="Search categories…"
          toolbar={
            canCreate && (
              <Button onClick={() => setEditing("new")}>
                <Plus /> Add category
              </Button>
            )
          }
          columns={[
            {
              key: "name",
              header: "Category",
              value: (r) => r.name,
              cell: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  {r.parentName && <p className="text-xs text-muted-foreground">in {r.parentName}</p>}
                </div>
              ),
            },
            {
              key: "products",
              header: "Products",
              align: "right",
              value: (r) => r.products,
              cell: (r) =>
                r.products ? (
                  <Link href={`/app/products?categoryId=${r.id}`} className="num text-primary hover:underline">
                    {r.products}
                  </Link>
                ) : (
                  <span className="num text-muted-foreground">0</span>
                ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (r) => (
                <div className="flex justify-end gap-1">
                  {canUpdate && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}>
                      <Pencil />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(r)}
                      aria-label={`Delete ${r.name}`}
                      disabled={r.products > 0 || r.children > 0}
                      title={r.products > 0 ? "Move its products first" : r.children > 0 ? "Has sub-categories" : undefined}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      {editing && (
        <CategoryDialog
          row={editing === "new" ? null : editing}
          categories={rows}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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
