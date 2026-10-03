"use client"

import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { useApp } from "@/components/app/app-context"
import { api, ApiError, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  customerFormSchema,
  signedOpening,
  splitOpening,
  type CustomerFormInput,
  type CustomerFormOutput,
} from "@/lib/validation/customers"

export type CustomerFormRow = {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  type: string
  creditLimit: number
  openingBalance: number
  notes: string | null
  branchId: string | null
  status: string
}

/** Create / edit customer. Opening balance (CRM-02) is only settable at creation. */
export function CustomerDialog({ row, onClose, onSaved }: { row: CustomerFormRow | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const router = useRouter()
  const app = useApp()
  const { register, handleSubmit, formState, setError, control } = useForm<CustomerFormInput, unknown, CustomerFormOutput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: row
      ? {
          name: row.name,
          phone: row.phone ?? "",
          email: row.email ?? "",
          address: row.address ?? "",
          type: row.type as CustomerFormOutput["type"],
          creditLimit: row.creditLimit,
          notes: row.notes ?? "",
          branchId: row.branchId ?? "none",
          status: row.status as CustomerFormOutput["status"],
          openingAmount: 0,
          openingSide: "due",
        }
      : { type: "retail", creditLimit: 0, openingAmount: 0, openingSide: "due", branchId: "none", status: "active" },
  })
  const e = formState.errors
  const opening = row ? splitOpening(row.openingBalance) : null

  const onSubmit = handleSubmit(async ({ openingAmount, openingSide, ...v }) => {
    try {
      const saved = row
        ? await api.patch<{ id: string }>(`/api/v1/customers/${row.id}`, v)
        : await api.post<{ id: string; code: string }>("/api/v1/customers", { ...v, openingBalance: signedOpening(openingAmount, openingSide) })
      toast.success(row ? "Customer updated" : "Customer created")
      onClose()
      onSaved?.(saved.id)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields?.openingBalance) setError("openingAmount", { message: err.details.fields.openingBalance })
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-4" /> {row ? `Edit ${row.code}` : "New customer"}
          </DialogTitle>
          <DialogDescription>Customers can buy on credit up to their limit. Their ledger tracks every invoice and payment.</DialogDescription>
        </DialogHeader>
        <form id="customer-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Customer name" htmlFor="c-name" error={e.name?.message} required>
            <Input id="c-name" autoFocus {...register("name")} />
          </Field>
          <Field label="Phone" htmlFor="c-phone" error={e.phone?.message}>
            <Input id="c-phone" inputMode="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
          </Field>
          <Field label="Type" error={e.type?.message} required>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CUSTOMER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Email" htmlFor="c-email" error={e.email?.message}>
            <Input id="c-email" type="email" {...register("email")} />
          </Field>
          <Field label="Address" htmlFor="c-address" error={e.address?.message} className="sm:col-span-2">
            <Textarea id="c-address" rows={2} {...register("address")} />
          </Field>
          <Field label="Credit limit (৳)" htmlFor="c-limit" error={e.creditLimit?.message} hint="0 = cash sales only. Credit invoices above the limit are blocked.">
            <Input id="c-limit" type="number" step="0.01" min="0" inputMode="decimal" {...register("creditLimit")} />
          </Field>
          <Field label="Home branch" error={e.branchId?.message}>
            <Controller
              control={control}
              name="branchId"
              render={({ field }) => (
                <Select value={field.value ?? "none"} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any branch</SelectItem>
                    {app.branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {row ? (
            <Field label="Opening balance" hint="Set at creation; changes only through invoices, payments and returns." className="sm:col-span-2">
              <Input
                value={opening && opening.amount ? `${money(opening.amount)} ${opening.side === "advance" ? "advance" : "due"}` : "None"}
                disabled
              />
            </Field>
          ) : (
            <div className="grid gap-1.5 sm:col-span-2">
              <p className="text-[13px] font-medium">Opening balance</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Controller
                  control={control}
                  name="openingSide"
                  render={({ field }) => (
                    <div className="inline-flex h-9 shrink-0 rounded-lg border p-0.5" role="radiogroup" aria-label="Opening balance type">
                      {(["due", "advance"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={field.value === s}
                          onClick={() => field.onChange(s)}
                          className={cn(
                            "rounded-md px-3 text-sm font-medium transition-colors",
                            field.value === s
                              ? s === "due"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-success/12 text-success"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {s === "due" ? "Due (owes us)" : "Advance (paid us)"}
                        </button>
                      ))}
                    </div>
                  )}
                />
                <Input
                  id="c-opening"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  aria-label="Opening amount"
                  className="sm:max-w-[200px]"
                  {...register("openingAmount")}
                />
              </div>
              {e.openingAmount?.message ? (
                <p className="text-xs font-medium text-destructive">{e.openingAmount.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Migrating existing dues or advances. This can only be set now.</p>
              )}
            </div>
          )}

          <Field label="Notes" htmlFor="c-notes" error={e.notes?.message} className="sm:col-span-2">
            <Textarea id="c-notes" rows={2} {...register("notes")} />
          </Field>
          {row && (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <label className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Inactive customers are hidden from the POS. Their ledger is kept.</p>
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
          <Button type="submit" form="customer-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save changes" : "Create customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
