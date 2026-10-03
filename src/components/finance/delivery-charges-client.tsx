"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Pencil, Plus, Trash2, Truck } from "lucide-react"
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { Field } from "@/components/shared/field"
import { LcPicker, type LcOption } from "@/components/shared/pickers"
import { StatusBadge } from "@/components/shared/status-badge"
import { useApp } from "@/components/app/app-context"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { date, money } from "@/lib/format"
import { deliveryChargeSchema, type DeliveryChargeInput, type DeliveryChargeOutput } from "@/lib/validation/finance"
import type { ExpenseRowView } from "@/server/modules/finance/queries"
import { BranchSelect, MethodBadge, MethodSelect, dayDate, todayKey } from "./shared"

type ByLc = { lcId: string; lcNumber: string; status: string; supplier: string; count: number; amount: number; lastDate: string | null; branches: { name: string; amount: number }[] }

export function DeliveryChargesClient({
  rows,
  total,
  sum,
  page,
  limit,
  byLc,
  canDelete,
}: {
  rows: ExpenseRowView[]
  total: number
  sum: number
  page: number
  limit: number
  byLc: ByLc[]
  canDelete: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<ExpenseRowView | null>(null)
  const [deleting, setDeleting] = useState<ExpenseRowView | null>(null)
  const grand = byLc.reduce((a, r) => a + Math.round(r.amount * 100), 0) / 100

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/api/v1/delivery-charges/${deleting.id}`)
      toast.success("Delivery charge deleted", { description: `Recalculate LC ${deleting.lcNumber}'s landed cost to apply the change.` })
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Truck className="size-4" /> New delivery charge
            </h2>
            <p className="text-xs text-muted-foreground">LC, branch, date and method stay filled for the next entry.</p>
          </div>
          <div className="p-5">
            <DeliveryForm onSaved={() => router.refresh()} />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Total delivery charge by LC</h2>
              <p className="text-xs text-muted-foreground">For the branch and date filters below.</p>
            </div>
            <p className="num text-lg font-semibold">{money(grand)}</p>
          </div>
          {byLc.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">No delivery charges recorded yet.</p>
          ) : (
            <ul className="max-h-[360px] divide-y overflow-y-auto">
              {byLc.map((l) => (
                <li key={l.lcId} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="num flex items-center gap-2 text-sm font-medium">
                      {l.lcNumber}
                      <StatusBadge tone={l.status === "closed" ? "neutral" : "info"} className="capitalize">
                        {l.status.replaceAll("_", " ")}
                      </StatusBadge>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.supplier} · {l.count} entr{l.count === 1 ? "y" : "ies"}
                      {l.lastDate && ` · last ${date(dayDate(l.lastDate))}`}
                    </p>
                    {l.branches.length > 1 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{l.branches.map((b) => `${b.name}: ${money(b.amount)}`).join(" · ")}</p>
                    )}
                  </div>
                  <span className="num shrink-0 font-semibold">{money(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ServerTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        rowKey={(r) => r.id}
        searchPlaceholder="Search number, vehicle, reference…"
        filters={
          <>
            <BranchFilter />
            {byLc.length > 0 && <SelectFilter name="lcId" placeholder="All LCs" options={byLc.map((l) => ({ value: l.lcId, label: l.lcNumber }))} />}
            <DateRangeFilter />
          </>
        }
        actions={<span className="num text-sm text-muted-foreground">Listed total: <b className="text-foreground">{money(sum)}</b></span>}
        empty="No delivery charges for these filters."
        columns={[
          { key: "number", header: "Number", sortKey: "number", cell: (r) => <span className="num text-xs font-medium">{r.number}</span> },
          { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(dayDate(r.date))}</span> },
          { key: "lc", header: "LC", cell: (r) => <span className="num text-sm">{r.lcNumber ?? "—"}</span> },
          { key: "branch", header: "Branch", cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{r.branchName}</span> },
          {
            key: "description",
            header: "Vehicle / description",
            className: "min-w-[180px]",
            cell: (r) => (
              <div className="max-w-[300px]">
                <p className="truncate">{r.description || "—"}</p>
                {r.reference && <p className="truncate text-xs text-muted-foreground">Ref: {r.reference}</p>}
              </div>
            ),
          },
          { key: "method", header: "Method", cell: (r) => <MethodBadge method={r.method} /> },
          { key: "amount", header: "Amount", sortKey: "amount", align: "right", cell: (r) => <span className="num font-medium">{money(r.amount)}</span> },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.number}`}>
                  <Pencil />
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(r)}
                    aria-label={`Delete ${r.number}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit delivery charge {editing.number}</DialogTitle>
              <DialogDescription>The LC&apos;s cost item is updated too. Recalculate its landed cost afterwards.</DialogDescription>
            </DialogHeader>
            <DeliveryForm
              row={editing}
              onSaved={() => {
                setEditing(null)
                router.refresh()
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete delivery charge {deleting?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {money(deleting?.amount ?? 0)} is removed from LC {deleting?.lcNumber}&apos;s cost items and from expenses. This cannot be undone.
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

function DeliveryForm({ row, onSaved }: { row?: ExpenseRowView; onSaved: () => void }) {
  const app = useApp()
  const [lc, setLc] = useState<LcOption | null>(row?.lcId ? { id: row.lcId, lcNumber: row.lcNumber ?? "LC", status: row.lcStatus ?? "", supplierName: "" } : null)
  const { register, handleSubmit, formState, setError, control, setValue, reset, getValues } = useForm<DeliveryChargeInput, unknown, DeliveryChargeOutput>({
    resolver: zodResolver(deliveryChargeSchema),
    defaultValues: row
      ? {
          lcId: row.lcId ?? "",
          branchId: row.branchId,
          amount: row.amount,
          method: row.method as DeliveryChargeInput["method"],
          date: row.date,
          description: row.description ?? "",
          reference: row.reference ?? "",
        }
      : { lcId: "", branchId: app.activeBranchId, method: "cash", date: todayKey(), description: "", reference: "" },
  })
  const e = formState.errors
  const id = row ? `dc-${row.id}` : "dc-new"

  const onSubmit = handleSubmit(async (v) => {
    try {
      if (row) {
        await api.patch(`/api/v1/delivery-charges/${row.id}`, v)
        toast.success("Delivery charge updated")
      } else {
        const res = await api.post<{ number: string }>("/api/v1/delivery-charges", v)
        toast.success(`Delivery charge ${res.number} recorded`, { description: `Added to LC ${lc?.lcNumber}. Recalculate its landed cost to apply it.` })
        const keep = getValues()
        reset({ ...keep, amount: undefined, description: "", reference: "" })
      }
      onSaved()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="LC number" error={e.lcId?.message} required className="sm:col-span-2">
        <LcPicker
          openOnly
          value={lc}
          onChange={(v) => {
            setLc(v)
            setValue("lcId", v?.id ?? "", { shouldValidate: formState.isSubmitted })
          }}
        />
      </Field>
      <Field label="Branch" error={e.branchId?.message} required>
        <Controller control={control} name="branchId" render={({ field }) => <BranchSelect value={field.value} onChange={field.onChange} />} />
      </Field>
      <Field label="Date" htmlFor={`${id}-date`} error={e.date?.message} required>
        <Input id={`${id}-date`} type="date" max={todayKey()} {...register("date")} />
      </Field>
      <Field label="Amount (৳)" htmlFor={`${id}-amount`} error={e.amount?.message} required>
        <Input id={`${id}-amount`} type="number" inputMode="decimal" step="0.01" min="0" className="num" {...register("amount")} />
      </Field>
      <Field label="Paid by" error={e.method?.message} required>
        <Controller control={control} name="method" render={({ field }) => <MethodSelect value={field.value ?? "cash"} onChange={field.onChange} />} />
      </Field>
      <Field label="Vehicle / description" htmlFor={`${id}-desc`} error={e.description?.message} className="sm:col-span-2">
        <Input id={`${id}-desc`} placeholder="e.g. Covered van DHK-METRO-TA 11-2345, Chattogram port → Tejgaon" {...register("description")} />
      </Field>
      <Field label="Reference" htmlFor={`${id}-ref`} error={e.reference?.message} className="sm:col-span-2">
        <Input id={`${id}-ref`} placeholder="Challan / receipt no." {...register("reference")} />
      </Field>
      <Button type="submit" className="sm:col-span-2" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? <Loader2 className="animate-spin" /> : row ? <Pencil /> : <Plus />}
        {row ? "Save changes" : "Add delivery charge"}
      </Button>
    </form>
  )
}
