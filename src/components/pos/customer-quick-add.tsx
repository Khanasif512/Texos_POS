"use client"

import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import type { CustomerOption } from "@/components/shared/pickers"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { quickCustomerSchema, type QuickCustomerInput, type QuickCustomerOutput } from "@/lib/validation/sales"

type Created = Partial<Omit<CustomerOption, "creditLimit" | "balance">> & { id: string; creditLimit?: unknown; balance?: unknown }

/** Add a walk-in as a customer without leaving the POS. */
export function CustomerQuickAdd({
  open,
  initialName,
  onClose,
  onCreated,
}: {
  open: boolean
  initialName?: string
  onClose: () => void
  onCreated: (c: CustomerOption) => void
}) {
  const { register, handleSubmit, formState, setError, control, reset } = useForm<QuickCustomerInput, unknown, QuickCustomerOutput>({
    resolver: zodResolver(quickCustomerSchema),
    values: { name: initialName ?? "", phone: "", address: "", type: "retail" },
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      const c = await api.post<Created>("/api/v1/customers", v)
      onCreated({
        id: c.id,
        code: c.code ?? "",
        name: c.name ?? v.name,
        phone: c.phone ?? v.phone,
        address: c.address ?? v.address,
        type: c.type ?? v.type,
        creditLimit: Number(c.creditLimit ?? 0) || 0,
        balance: Number(c.balance ?? 0) || 0,
      })
      toast.success(`${v.name} added`)
      reset()
      onClose()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>Saved to your customer list and attached to this sale. Credit limit starts at zero.</DialogDescription>
        </DialogHeader>
        <form id="pos-customer-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="qc-name" error={e.name?.message} required>
            <Input id="qc-name" autoFocus {...register("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="qc-phone" error={e.phone?.message} required>
              <Input id="qc-phone" inputMode="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
            </Field>
            <Field label="Type" error={e.type?.message}>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="dealer">Dealer</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field label="Address" htmlFor="qc-address" error={e.address?.message}>
            <Textarea id="qc-address" rows={2} {...register("address")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pos-customer-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Add customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
