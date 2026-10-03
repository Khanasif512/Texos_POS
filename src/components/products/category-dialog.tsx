"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FolderTree, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/shared/field"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { categorySchema, type CategoryInput, type CategoryOutput } from "@/lib/validation/products"

export type CategoryOption = { id: string; name: string; parentId: string | null }

export function CategoryDialog({
  row,
  categories,
  onClose,
  onSaved,
}: {
  row: CategoryOption | null
  categories: CategoryOption[]
  onClose: () => void
  onSaved: (c: CategoryOption) => void
}) {
  const { register, handleSubmit, formState, setError, control } = useForm<CategoryInput, unknown, CategoryOutput>({
    resolver: zodResolver(categorySchema),
    defaultValues: row ? { name: row.name, parentId: row.parentId ?? "none" } : { name: "", parentId: "none" },
  })
  const e = formState.errors
  const parents = categories.filter((c) => c.id !== row?.id && c.parentId !== row?.id)
  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = row
        ? await api.patch<CategoryOption>(`/api/v1/categories/${row.id}`, v)
        : await api.post<CategoryOption>("/api/v1/categories", v)
      toast.success(row ? "Category updated" : "Category created")
      onSaved(saved)
      onClose()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="size-4" /> {row ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription>Group products for search, filters and stock reports.</DialogDescription>
        </DialogHeader>
        <form
          id="category-form"
          onSubmit={(ev) => {
            ev.stopPropagation()
            onSubmit(ev)
          }}
          className="grid gap-4"
          noValidate
        >
          <Field label="Name" htmlFor="cat-name" error={e.name?.message} required>
            <Input id="cat-name" autoFocus placeholder="e.g. Aluminium Profiles" {...register("name")} />
          </Field>
          {parents.length > 0 && (
            <Field label="Parent category" error={e.parentId?.message} hint="Optional — for sub-categories.">
              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <Select value={field.value ?? "none"} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (top level)</SelectItem>
                      {parents.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
