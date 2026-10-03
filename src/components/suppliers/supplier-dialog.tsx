"use client"

import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { money } from "@/lib/format"
import { SUPPLIER_CURRENCIES, supplierSchema, type SupplierInput, type SupplierOutput } from "@/lib/validation/suppliers"

export type SupplierFormRow = {
  id: string
  code: string
  name: string
  country: string | null
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  bankDetails: string | null
  currency: string
  openingBalance: number
  notes: string | null
  status: string
}

const CURRENCY_LABEL: Record<string, string> = { RMB: "RMB — Chinese Yuan", USD: "USD — US Dollar", BDT: "BDT — Taka" }

/** Create / edit supplier. Opening balance can only be set when the supplier is created. */
export function SupplierDialog({ row, onClose, onSaved }: { row: SupplierFormRow | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, control } = useForm<SupplierInput, unknown, SupplierOutput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: row
      ? {
          name: row.name,
          country: row.country ?? "",
          contactPerson: row.contactPerson ?? "",
          phone: row.phone ?? "",
          email: row.email ?? "",
          address: row.address ?? "",
          bankDetails: row.bankDetails ?? "",
          currency: row.currency as SupplierOutput["currency"],
          openingBalance: row.openingBalance,
          notes: row.notes ?? "",
          status: row.status as SupplierOutput["status"],
        }
      : { currency: "RMB", country: "China", openingBalance: 0, status: "active" },
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = row
        ? await api.patch<{ id: string }>(`/api/v1/suppliers/${row.id}`, v)
        : await api.post<{ id: string; code: string }>("/api/v1/suppliers", v)
      toast.success(row ? "Supplier updated" : "Supplier created")
      onClose()
      onSaved?.(saved.id)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-4" /> {row ? `Edit ${row.code}` : "New supplier"}
          </DialogTitle>
          <DialogDescription>Overseas or local suppliers you open LCs and purchase orders against.</DialogDescription>
        </DialogHeader>
        <form id="supplier-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Supplier name" htmlFor="s-name" error={e.name?.message} required className="sm:col-span-2">
            <Input id="s-name" autoFocus placeholder="e.g. Foshan Nanhai Guangjun Aluminium Co., Ltd." {...register("name")} />
          </Field>
          <Field label="Country" htmlFor="s-country" error={e.country?.message}>
            <Input id="s-country" placeholder="China" {...register("country")} />
          </Field>
          <Field label="Currency" error={e.currency?.message} required>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CURRENCY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Contact person" htmlFor="s-contact" error={e.contactPerson?.message}>
            <Input id="s-contact" {...register("contactPerson")} />
          </Field>
          <Field label="Phone / WeChat" htmlFor="s-phone" error={e.phone?.message}>
            <Input id="s-phone" {...register("phone")} />
          </Field>
          <Field label="Email" htmlFor="s-email" error={e.email?.message} className="sm:col-span-2">
            <Input id="s-email" type="email" {...register("email")} />
          </Field>
          <Field label="Address" htmlFor="s-address" error={e.address?.message} className="sm:col-span-2">
            <Textarea id="s-address" rows={2} {...register("address")} />
          </Field>
          <Field
            label="Bank details (for LC)"
            htmlFor="s-bank"
            error={e.bankDetails?.message}
            hint="Beneficiary name, bank, account no., SWIFT — used when opening LCs."
            className="sm:col-span-2"
          >
            <Textarea id="s-bank" rows={3} className="font-mono text-xs" {...register("bankDetails")} />
          </Field>
          {row ? (
            <Field label="Opening balance (৳)" hint="Set at creation. Later changes go through payments and purchases.">
              <Input value={money(row.openingBalance)} disabled />
            </Field>
          ) : (
            <Field
              label="Opening payable (৳)"
              htmlFor="s-opening"
              error={e.openingBalance?.message}
              hint="What you already owe this supplier, in Taka. Can only be set now."
            >
              <Input id="s-opening" type="number" step="0.01" min="0" inputMode="decimal" {...register("openingBalance")} />
            </Field>
          )}
          <Field label="Notes" htmlFor="s-notes" error={e.notes?.message} className={row ? undefined : "sm:col-span-1"}>
            <Textarea id="s-notes" rows={2} {...register("notes")} />
          </Field>
          {row && (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <label className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Inactive suppliers cannot be chosen for new LCs or purchase orders. History is kept.</p>
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
          <Button type="submit" form="supplier-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save changes" : "Create supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
