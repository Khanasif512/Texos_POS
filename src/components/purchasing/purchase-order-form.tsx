"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { SupplierPicker, VariationPicker, type SupplierOption, type VariationOption } from "@/components/shared/pickers"
import { useApp } from "@/components/app/app-context"
import { api, ApiError, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { amount, money, quantity } from "@/lib/format"
import { CURRENCIES, purchaseOrderSchema, type PurchaseOrderInput, type PurchaseOrderOutput } from "@/lib/validation/purchasing"

export type PurchaseOrderFormInitial = {
  id: string
  number: string
  supplier: SupplierOption
  invoiceReference: string | null
  bankDetails: string | null
  branchId: string
  orderDate: string
  expectedDate: string | null
  currency: string
  exchangeRate: number
  notes: string | null
  lines: { variation: VariationOption; quantity: number; unitPrice: number }[]
}

const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

export function PurchaseOrderForm({ initial, today }: { initial?: PurchaseOrderFormInitial; today: string }) {
  const router = useRouter()
  const app = useApp()
  const [idemKey] = useState(() => crypto.randomUUID())
  const [supplier, setSupplier] = useState<SupplierOption | null>(initial?.supplier ?? null)
  const [picks, setPicks] = useState<Record<string, VariationOption>>(() =>
    Object.fromEntries((initial?.lines ?? []).map((l) => [l.variation.id, l.variation])),
  )
  const { register, handleSubmit, control, formState, setError, setValue, setFocus, clearErrors } = useForm<
    PurchaseOrderInput,
    unknown,
    PurchaseOrderOutput
  >({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: initial
      ? {
          supplierId: initial.supplier.id,
          branchId: initial.branchId,
          invoiceReference: initial.invoiceReference ?? "",
          bankDetails: initial.bankDetails ?? "",
          orderDate: initial.orderDate,
          expectedDate: initial.expectedDate ?? "",
          currency: initial.currency as "BDT",
          exchangeRate: initial.exchangeRate,
          notes: initial.notes ?? "",
          lines: initial.lines.map((l) => ({ variationId: l.variation.id, quantity: l.quantity, unitPrice: l.unitPrice })),
        }
      : {
          supplierId: "",
          branchId: app.activeBranchId,
          invoiceReference: "",
          bankDetails: "",
          orderDate: today,
          expectedDate: "",
          currency: "BDT",
          exchangeRate: 1,
          notes: "",
          lines: [{ variationId: "", quantity: "", unitPrice: "" }],
        },
  })
  const { fields, append, remove } = useFieldArray({ control, name: "lines" })
  const lines = useWatch({ control, name: "lines" }) ?? []
  const currency = useWatch({ control, name: "currency" }) ?? "BDT"
  const rate = n(useWatch({ control, name: "exchangeRate" }))
  const foreign = currency !== "BDT"
  const toBdt = (p: unknown) => (foreign ? n(p) * rate : n(p))
  const totalBdt = lines.reduce((a, l) => a + n(l?.quantity) * toBdt(l?.unitPrice), 0)
  const totalForeign = lines.reduce((a, l) => a + n(l?.quantity) * n(l?.unitPrice), 0)
  const e = formState.errors

  const addLine = () => {
    append({ variationId: "", quantity: "", unitPrice: "" })
  }

  const onSubmit = handleSubmit(
    async (v) => {
      try {
        if (initial) {
          await api.patch(`/api/v1/purchase-orders/${initial.id}`, v)
          toast.success(`${initial.number} updated`)
          router.push(`/app/purchases/${initial.id}`)
        } else {
          const res = await api.post<{ id: string; number: string }>("/api/v1/purchase-orders", v, { idempotencyKey: idemKey })
          toast.success(`Purchase order ${res.number} created`)
          router.push(`/app/purchases/${res.id}`)
        }
        router.refresh()
      } catch (err) {
        const hasFieldErrors = applyFieldErrors(err, setError)
        const details =
          hasFieldErrors && err instanceof ApiError && err.details?.fields
            ? Object.entries(err.details.fields)
                .map(([field, message]) => `${field}: ${message}`)
                .join(" · ")
            : undefined
        toast.error(errorMessage(err), details ? { description: details } : undefined)
      }
    },
    (errors) => {
      const lineMessages = (Array.isArray(errors.lines) ? errors.lines : []).map((line) =>
        [line?.variationId?.message, line?.quantity?.message, line?.unitPrice?.message].filter((message): message is string => !!message),
      )
      const messages = [
        errors.supplierId?.message,
        errors.branchId?.message,
        errors.invoiceReference?.message,
        errors.bankDetails?.message,
        errors.orderDate?.message,
        errors.expectedDate?.message,
        errors.currency?.message,
        errors.exchangeRate?.message,
        errors.notes?.message,
        errors.lines?.root?.message ?? errors.lines?.message,
        ...lineMessages.flatMap((line, index) => line.map((message) => `Item ${index + 1}: ${message}`)),
      ].filter((message): message is string => !!message)
      toast.error("Please check the purchase order fields", {
        description: messages.join(" · ") || "Review the highlighted fields and try again.",
      })
    },
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Order details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Supplier" error={e.supplierId?.message} required className="sm:col-span-2">
            <SupplierPicker
              value={supplier}
              onChange={(s) => {
                setSupplier(s)
                setValue("supplierId", s?.id ?? "", { shouldValidate: formState.isSubmitted })
              }}
            />
          </Field>
          <Field label="Receiving branch" error={e.branchId?.message} required hint={initial ? "Fixed once the order exists" : undefined}>
            <Controller
              control={control}
              name="branchId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!initial}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a branch" />
                  </SelectTrigger>
                  <SelectContent>
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
          <Field label="Invoice reference" htmlFor="invoiceReference" error={e.invoiceReference?.message} hint="Optional">
            <Input id="invoiceReference" placeholder="Enter supplier invoice number" {...register("invoiceReference")} />
          </Field>
          <Field label="Bank details" htmlFor="bankDetails" error={e.bankDetails?.message} hint="Optional">
            <Textarea id="bankDetails" rows={2} placeholder="Beneficiary, bank, account number…" {...register("bankDetails")} />
          </Field>
          <Field label="Order date" htmlFor="orderDate" error={e.orderDate?.message} required>
            <Input id="orderDate" type="date" {...register("orderDate")} />
          </Field>
          <Field label="Expected delivery" htmlFor="expectedDate" error={e.expectedDate?.message}>
            <Input id="expectedDate" type="date" {...register("expectedDate")} />
          </Field>
          <Field label="Currency" error={e.currency?.message}>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    if (v === "BDT") setValue("exchangeRate", 1)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "BDT" ? "BDT (local purchase)" : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {foreign && (
            <Field label={`Exchange rate (৳ per ${currency})`} htmlFor="exchangeRate" error={e.exchangeRate?.message} required>
              <Input id="exchangeRate" type="number" step="0.000001" min="0" className="num" {...register("exchangeRate")} />
            </Field>
          )}
          <Field label="Notes" htmlFor="notes" error={e.notes?.message} className="sm:col-span-2 lg:col-span-4">
            <Textarea id="notes" rows={2} placeholder="Payment terms, delivery instructions…" {...register("notes")} />
          </Field>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Items</h2>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus /> Add item
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">Quantity</th>
                <th className="w-36 px-2 py-2.5 text-right font-medium">Unit price ({currency})</th>
                {foreign && <th className="w-32 px-2 py-2.5 text-right font-medium">Unit price (৳)</th>}
                <th className="w-36 px-2 py-2.5 text-right font-medium">Line total (৳)</th>
                <th className="w-12 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((f, i) => {
                const vid = lines[i]?.variationId
                const v = vid ? picks[vid] : undefined
                const le = e.lines?.[i]
                return (
                  <tr key={f.id} className="align-top">
                    <td className="px-4 py-2.5">
                      <VariationPicker
                        value={v ?? null}
                        branchId={undefined}
                        onChange={(opt) => {
                          if (opt) setPicks((p) => ({ ...p, [opt.id]: opt }))
                          setValue(`lines.${i}.variationId`, opt?.id ?? "", { shouldValidate: formState.isSubmitted })
                          if (opt) setTimeout(() => setFocus(`lines.${i}.quantity`), 50)
                        }}
                      />
                      {le?.variationId?.message && <p className="mt-1 text-xs font-medium text-destructive">{le.variationId.message}</p>}
                      {v && <p className="mt-1 text-xs text-muted-foreground">{v.sku} · {v.unit}</p>}
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        inputMode="decimal"
                        className="num h-9 text-right"
                        aria-label="Quantity"
                        aria-invalid={!!le?.quantity}
                        {...register(`lines.${i}.quantity`)}
                      />
                      {le?.quantity?.message && <p className="mt-1 text-xs font-medium text-destructive">{le.quantity.message}</p>}
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        inputMode="decimal"
                        className="num h-9 text-right"
                        aria-label="Unit price"
                        aria-invalid={!!le?.unitPrice}
                        {...register(`lines.${i}.unitPrice`)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" && i === fields.length - 1) {
                            ev.preventDefault()
                            addLine()
                          }
                        }}
                      />
                      {le?.unitPrice?.message && <p className="mt-1 text-xs font-medium text-destructive">{le.unitPrice.message}</p>}
                    </td>
                    {foreign && <td className="num px-2 py-4 text-right text-muted-foreground">{amount(toBdt(lines[i]?.unitPrice))}</td>}
                    <td className="num px-2 py-4 text-right font-medium">{amount(n(lines[i]?.quantity) * toBdt(lines[i]?.unitPrice))}</td>
                    <td className="px-2 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove item"
                        disabled={fields.length === 1}
                        onClick={() => {
                          remove(i)
                          clearErrors("lines")
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {(e.lines?.message || e.lines?.root?.message) && (
          <p className="border-t px-5 py-2 text-xs font-medium text-destructive">{e.lines?.message ?? e.lines?.root?.message}</p>
        )}
        <div className="flex flex-col items-end gap-1 border-t bg-muted/20 px-5 py-4 text-sm">
          <p className="text-muted-foreground">
            {fields.length} item(s) · {quantity(lines.reduce((a, l) => a + n(l?.quantity), 0))} units
          </p>
          {foreign && (
            <p className="text-muted-foreground">
              Total ({currency}) <span className="num ml-2 text-foreground">{amount(totalForeign)}</span>
            </p>
          )}
          <p className="text-base font-semibold">
            Total <span className="num ml-2">{money(totalBdt)}</span>
          </p>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {initial ? "Save changes" : "Create purchase order"}
        </Button>
      </div>
    </form>
  )
}
