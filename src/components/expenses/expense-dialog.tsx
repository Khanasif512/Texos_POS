"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Wallet, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/shared/field"
import { LcPicker, type LcOption } from "@/components/shared/pickers"
import { useApp } from "@/components/app/app-context"
import { BranchSelect, MethodSelect, todayKey } from "@/components/finance/shared"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { expenseSchema, LC_COST_TYPE_LABELS, type ExpenseInput, type ExpenseOutput, type LcCostTypeKey } from "@/lib/validation/finance"
import type { ExpenseRowView } from "@/server/modules/finance/queries"

export type CategoryOption = { id: string; name: string; status: string; lcCostType: string | null }

export function ExpenseDialog({
  row,
  categories,
  lcEnabled,
  onClose,
}: {
  row: ExpenseRowView | null
  categories: CategoryOption[]
  lcEnabled: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const app = useApp()
  const [lc, setLc] = useState<LcOption | null>(
    row?.lcId ? { id: row.lcId, lcNumber: row.lcNumber ?? "LC", status: row.lcStatus ?? "", supplierName: "" } : null,
  )
  const { register, handleSubmit, formState, setError, control, watch, setValue } = useForm<ExpenseInput, unknown, ExpenseOutput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: row
      ? {
          branchId: row.branchId,
          categoryId: row.categoryId,
          amount: row.amount,
          method: row.method as ExpenseInput["method"],
          date: row.date,
          description: row.description ?? "",
          reference: row.reference ?? "",
          lcId: row.lcId,
          allocateToLc: row.allocateToLc,
        }
      : { branchId: app.activeBranchId, categoryId: "", method: "cash", date: todayKey(), description: "", reference: "", lcId: null, allocateToLc: false },
  })
  const e = formState.errors
  const categoryId = watch("categoryId")
  const allocate = watch("allocateToLc")
  const category = categories.find((c) => c.id === categoryId)
  const usable = categories.filter((c) => c.status === "active" || c.id === row?.categoryId)

  const onSubmit = handleSubmit(async (v) => {
    try {
      if (row) {
        await api.patch(`/api/v1/expenses/${row.id}`, v)
        toast.success(`Expense ${row.number} updated`)
      } else {
        const res = await api.post<{ number: string; lcCostItemId: string | null }>("/api/v1/expenses", v)
        toast.success(`Expense ${res.number} recorded`, {
          description: res.lcCostItemId ? "Added to the LC's cost items. Recalculate its landed cost to apply it." : undefined,
        })
      }
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4" /> {row ? `Edit expense ${row.number}` : "Record expense"}
          </DialogTitle>
          <DialogDescription>Cash expenses reduce the branch&apos;s expected cash in the daily closing.</DialogDescription>
        </DialogHeader>
        <form id="expense-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Branch" error={e.branchId?.message} required>
            <Controller control={control} name="branchId" render={({ field }) => <BranchSelect value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Date" htmlFor="date" error={e.date?.message} required>
            <Input id="date" type="date" max={todayKey()} {...register("date")} />
          </Field>
          <Field label="Category" error={e.categoryId?.message} required>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {usable.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Amount (৳)" htmlFor="amount" error={e.amount?.message} required>
            <Input id="amount" type="number" inputMode="decimal" step="0.01" min="0" className="num" autoFocus={!row} {...register("amount")} />
          </Field>
          <Field label="Payment method" error={e.method?.message} required>
            <Controller control={control} name="method" render={({ field }) => <MethodSelect value={field.value ?? "cash"} onChange={field.onChange} />} />
          </Field>
          <Field label="Reference" htmlFor="reference" error={e.reference?.message} hint="Voucher, cheque or bill no.">
            <Input id="reference" {...register("reference")} />
          </Field>
          <Field label="Description" htmlFor="description" error={e.description?.message} className="sm:col-span-2">
            <Input id="description" placeholder="e.g. Showroom electricity bill — September" {...register("description")} />
          </Field>

          {lcEnabled && (
            <div className="grid gap-3 rounded-lg border p-3 sm:col-span-2">
              <Field label="Link to an LC (optional)" error={e.lcId?.message}>
                <div className="flex gap-2">
                  <LcPicker
                    openOnly
                    value={lc}
                    onChange={(v) => {
                      setLc(v)
                      setValue("lcId", v?.id ?? null, { shouldValidate: formState.isSubmitted })
                    }}
                  />
                  {lc && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9"
                      aria-label="Remove LC link"
                      onClick={() => {
                        setLc(null)
                        setValue("lcId", null)
                        setValue("allocateToLc", false)
                      }}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </Field>
              {lc && (
                <Controller
                  control={control}
                  name="allocateToLc"
                  render={({ field }) => (
                    <label className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Allocate to this LC&apos;s landed cost</p>
                        <p className="text-xs text-muted-foreground">
                          {field.value
                            ? `Added to LC ${lc.lcNumber} as “${LC_COST_TYPE_LABELS[(category?.lcCostType as LcCostTypeKey) ?? "other"]}” and kept out of the P&L.`
                            : "Off: the expense stays an operating expense and only references the LC."}
                        </p>
                      </div>
                      <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                    </label>
                  )}
                />
              )}
              {allocate && row?.allocateToLc && <p className="text-xs text-muted-foreground">Changing the amount updates the LC cost item — recalculate the landed cost afterwards.</p>}
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save changes" : "Record expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
