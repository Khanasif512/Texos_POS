"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link2, Loader2, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react"
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
import { Field } from "@/components/shared/field"
import { StatusBadge } from "@/components/shared/status-badge"
import { useCan } from "@/components/app/app-context"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { date, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  costItemSchema,
  LC_COST_TYPE_LABEL,
  LC_COST_TYPES,
  type CostItemInput,
  type CostItemOutput,
  type LcCostType,
} from "@/lib/validation/lc"
import { foreign, rate as fmtRate } from "./lc-format"

export type CostItemRow = {
  id: string
  costType: LcCostType
  amount: number
  description: string | null
  entryDate: string
  sourceType: string
  sourceId: string | null
}

const SOURCE_LABEL: Record<string, string> = { expense: "From expense", delivery_charge: "From delivery charge" }

/** LC-02 cost sheet: every charge as its own auditable row, grouped by type. */
export function CostSheet({
  lcId,
  status,
  currency,
  exchangeRate,
  totalForeign,
  baseCost,
  extraTotal,
  items,
}: {
  lcId: string
  status: string
  currency: string
  exchangeRate: number
  totalForeign: number
  /** Σ line value × rate (computed on the server) */
  baseCost: number
  extraTotal: number
  items: CostItemRow[]
}) {
  const router = useRouter()
  const canEdit = useCan("lc.update") && status !== "closed"
  const [editing, setEditing] = useState<CostItemRow | "new" | null>(null)
  const [deleting, setDeleting] = useState<CostItemRow | null>(null)

  const base = baseCost
  const extra = extraTotal
  const groups = LC_COST_TYPES.map((t) => ({ type: t, rows: items.filter((i) => i.costType === t) })).filter((g) => g.rows.length)

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/api/v1/lc/${lcId}/cost-items/${deleting.id}`)
      toast.success("Cost item removed")
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Cost sheet</h3>
            <p className="text-sm text-muted-foreground">All charges against this LC in BDT. They are distributed over the units as extra cost.</p>
          </div>
          {canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add cost item
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1 border-b bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Product purchase value (base cost)</p>
            <p className="text-xs text-muted-foreground">
              {exchangeRate > 0
                ? `${foreign(totalForeign, currency)} × ${fmtRate(exchangeRate)} — the base of the landed cost, not an extra cost item`
                : "Enter the exchange rate on the LC to convert the product value to BDT"}
            </p>
          </div>
          <p className="num text-base font-semibold">{exchangeRate > 0 ? money(base) : "—"}</p>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ReceiptText className="size-5" />
            </span>
            <p className="mt-3 font-medium">No cost items yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add LC opening cost, freight, port, CNF, transport, unloading, customs duty and other charges as they are paid.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="w-20 px-2 py-2" />
                </tr>
              </thead>
              {groups.map((g) => {
                const subtotal = g.rows.reduce((a, r) => a + Math.round(r.amount * 100), 0) / 100
                return (
                  <tbody key={g.type} className="border-b last:border-b-0">
                    <tr className="bg-muted/20">
                      <td className="px-4 pt-3 pb-1.5 font-medium" colSpan={2}>
                        {LC_COST_TYPE_LABEL[g.type]}
                        {g.rows.length > 1 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({g.rows.length})</span>}
                      </td>
                      <td className="num px-4 pt-3 pb-1.5 text-right font-medium">{money(subtotal)}</td>
                      <td />
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="group hover:bg-muted/30">
                        <td className="py-2 pr-4 pl-8">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn(!r.description && "text-muted-foreground")}>{r.description || LC_COST_TYPE_LABEL[r.costType]}</span>
                            {r.sourceType !== "manual" && (
                              <StatusBadge tone="info">
                                <Link2 className="size-3" />
                                {SOURCE_LABEL[r.sourceType] ?? "Linked"}
                              </StatusBadge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{date(r.entryDate)}</td>
                        <td className="num px-4 py-2 text-right">{money(r.amount)}</td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          {canEdit && r.sourceType === "manual" && (
                            <>
                              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label="Edit cost item">
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleting(r)}
                                aria-label="Delete cost item"
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}

        <div className="grid gap-1 border-t bg-muted/30 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total extra cost ({items.length} item{items.length === 1 ? "" : "s"})</span>
            <span className="num font-semibold">{money(extra)}</span>
          </div>
          {exchangeRate > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base + extra = total landed cost</span>
              <span className="num font-semibold">{money((Math.round(base * 100) + Math.round(extra * 100)) / 100)}</span>
            </div>
          )}
        </div>
      </div>
      {items.some((i) => i.sourceType !== "manual") && (
        <p className="text-xs text-muted-foreground">
          Items marked “From expense” or “From delivery charge” are allocated from the Expenses / Delivery modules and can only be changed there.
        </p>
      )}

      {editing && <CostItemDialog lcId={lcId} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this cost item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `${LC_COST_TYPE_LABEL[deleting.costType]} of ${money(deleting.amount)} will be removed from the cost sheet.`} If the landed
              cost was already calculated you will be asked to recalculate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CostItemDialog({ lcId, row, onClose }: { lcId: string; row: CostItemRow | null; onClose: () => void }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, control } = useForm<CostItemInput, unknown, CostItemOutput>({
    resolver: zodResolver(costItemSchema),
    defaultValues: row
      ? { costType: row.costType, amount: row.amount, description: row.description ?? "", entryDate: row.entryDate }
      : { costType: "freight", description: "", entryDate: new Date().toLocaleDateString("en-CA") },
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (row) await api.patch(`/api/v1/lc/${lcId}/cost-items/${row.id}`, v)
      else await api.post(`/api/v1/lc/${lcId}/cost-items`, v)
      toast.success(row ? "Cost item updated" : "Cost item added")
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row ? "Edit cost item" : "Add cost item"}</DialogTitle>
          <DialogDescription>Amounts are in BDT. Each charge is kept as its own row for audit.</DialogDescription>
        </DialogHeader>
        <form id="cost-item-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Cost type" error={e.costType?.message} required className="sm:col-span-2">
            <Controller
              control={control}
              name="costType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LC_COST_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LC_COST_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Amount (৳)" htmlFor="amount" error={e.amount?.message} required>
            <Input id="amount" type="number" step="0.01" min="0" className="num" autoFocus {...register("amount")} />
          </Field>
          <Field label="Date" htmlFor="entryDate" error={e.entryDate?.message} required>
            <Input id="entryDate" type="date" {...register("entryDate")} />
          </Field>
          <Field label="Description" htmlFor="description" error={e.description?.message} className="sm:col-span-2">
            <Input id="description" placeholder="e.g. Sea freight Ningbo → Chattogram" {...register("description")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cost-item-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
