"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Lock, Pencil, Plus, Tags, Trash2 } from "lucide-react"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DataTable } from "@/components/shared/data-table"
import { Field } from "@/components/shared/field"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"
import {
  expenseCategorySchema,
  LC_COST_TYPE_LABELS,
  LC_COST_TYPES,
  type ExpenseCategoryInput,
  type ExpenseCategoryOutput,
  type LcCostTypeKey,
} from "@/lib/validation/finance"

type Row = { id: string; name: string; isSystem: boolean; lcCostType: string | null; status: string; expenseCount: number; total: number }

export function CategoriesClient({ rows, canEdit, canDelete }: { rows: Row[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/api/v1/expense-categories/${deleting.id}`)
      toast.success("Category deleted")
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search categories…"
        toolbar={
          canEdit && (
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
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
                {r.isSystem && (
                  <StatusBadge tone="neutral">
                    <Lock className="size-2.5" /> Default
                  </StatusBadge>
                )}
              </div>
            ),
          },
          {
            key: "lc",
            header: "LC cost type",
            value: (r) => r.lcCostType ?? "",
            cell: (r) =>
              r.lcCostType ? (
                <StatusBadge tone="info">{LC_COST_TYPE_LABELS[r.lcCostType as LcCostTypeKey] ?? r.lcCostType}</StatusBadge>
              ) : (
                <span className="text-xs text-muted-foreground">Operating only</span>
              ),
          },
          { key: "count", header: "Entries", align: "right", value: (r) => r.expenseCount, cell: (r) => <span className="num">{r.expenseCount}</span> },
          { key: "total", header: "Total spent", align: "right", value: (r) => r.total, cell: (r) => <span className="num">{money(r.total)}</span> },
          { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <ActiveBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (r) =>
              canEdit && (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}>
                    <Pencil />
                  </Button>
                  {canDelete && !r.isSystem && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(r)}
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ),
          },
        ]}
        empty={
          <span className="inline-flex flex-col items-center gap-2">
            <Tags className="size-5" /> No categories yet.
          </span>
        }
      />
      {editing && <CategoryDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.expenseCount
                ? "This category has expenses, so it can only be deactivated."
                : "The category will be removed. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CategoryDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, control } = useForm<ExpenseCategoryInput, unknown, ExpenseCategoryOutput>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: row
      ? { name: row.name, lcCostType: (row.lcCostType as LcCostTypeKey | null) ?? null, status: row.status as "active" }
      : { name: "", lcCostType: null, status: "active" },
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (row) await api.patch(`/api/v1/expense-categories/${row.id}`, v)
      else await api.post("/api/v1/expense-categories", v)
      toast.success(row ? "Category updated" : "Category created")
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  const locked = !!row?.isSystem
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="size-4" /> {row ? "Edit category" : "New expense category"}
          </DialogTitle>
          <DialogDescription>Categories group your daily expenses in the P&amp;L and the daily expense summary.</DialogDescription>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="name" error={e.name?.message} hint={locked ? "Default categories cannot be renamed." : undefined} required>
            <Input id="name" autoFocus={!locked} disabled={locked} {...register("name")} />
          </Field>
          <Field
            label="LC cost type"
            error={e.lcCostType?.message}
            hint="Used when an expense of this category is allocated to an LC's landed cost."
          >
            <Controller
              control={control}
              name="lcCostType"
              render={({ field }) => (
                <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (counts as “Other” if allocated)</SelectItem>
                    {LC_COST_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LC_COST_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {row && (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <label className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Inactive categories are hidden when recording new expenses.</p>
                  </div>
                  <Switch checked={field.value === "active"} onCheckedChange={(c) => field.onChange(c ? "active" : "inactive")} />
                </label>
              )}
            />
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
