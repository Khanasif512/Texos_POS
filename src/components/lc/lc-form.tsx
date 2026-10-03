"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Lock, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { SupplierPicker, VariationPicker, type SupplierOption, type VariationOption } from "@/components/shared/pickers"
import { useApp } from "@/components/app/app-context"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  BASIS_LABEL,
  LC_CURRENCIES,
  lcLockedSchema,
  lcSchema,
  type LcInput,
  type LcOutput,
} from "@/lib/validation/lc"
import { foreign, kg } from "./lc-format"
import { LcStatusBadge } from "./lc-status"

export type LcFormValue = {
  id: string
  status: string
  supplier: SupplierOption
  lcNumber: string
  issuingBank: string
  branchId: string
  currency: "RMB" | "USD"
  lcValue: number
  exchangeRate: number
  distributionBasis: "weight" | "quantity"
  openedDate: string | null
  expectedArrivalDate: string | null
  actualArrivalDate: string | null
  notes: string | null
  lines: { id: string; variation: VariationOption; quantity: number; unitWeight: number; unitPriceForeign: number }[]
}

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(v)
  return Number.isFinite(x) ? x : 0
}

function Section({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function BasisChoice({ value, onChange, disabled }: { value: string; onChange: (v: "weight" | "quantity") => void; disabled?: boolean }) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as "weight" | "quantity")} className="grid-cols-2" disabled={disabled}>
      {(["weight", "quantity"] as const).map((b) => (
        <label
          key={b}
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50",
            value === b && "border-primary bg-primary/5",
          )}
        >
          <RadioGroupItem value={b} className="mt-0.5" />
          <span>
            <span className="font-medium">{BASIS_LABEL[b]}</span>
            <span className="block text-xs text-muted-foreground">{b === "weight" ? "By unit weight × quantity" : "By piece count"}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}

/** LC-01 create / edit (before goods are received). */
export function LcForm({ lc }: { lc?: LcFormValue }) {
  const router = useRouter()
  const app = useApp()
  const [supplier, setSupplier] = useState<SupplierOption | null>(lc?.supplier ?? null)
  const [variations, setVariations] = useState<Record<number, VariationOption | null>>(() =>
    Object.fromEntries((lc?.lines ?? []).map((l, i) => [i, l.variation])),
  )
  const { register, handleSubmit, formState, setError, control, setValue, getValues } = useForm<LcInput, unknown, LcOutput>({
    resolver: zodResolver(lcSchema),
    defaultValues: lc
      ? {
          supplierId: lc.supplier.id,
          lcNumber: lc.lcNumber,
          issuingBank: lc.issuingBank,
          branchId: lc.branchId,
          currency: lc.currency,
          lcValue: lc.lcValue,
          exchangeRate: lc.exchangeRate,
          distributionBasis: lc.distributionBasis,
          openedDate: lc.openedDate ?? "",
          expectedArrivalDate: lc.expectedArrivalDate ?? "",
          actualArrivalDate: lc.actualArrivalDate ?? "",
          notes: lc.notes ?? "",
          lines: lc.lines.map((l) => ({ id: l.id, variationId: l.variation.id, quantity: l.quantity, unitWeight: l.unitWeight, unitPriceForeign: l.unitPriceForeign })),
        }
      : {
          supplierId: "",
          lcNumber: "",
          issuingBank: "",
          branchId: app.activeBranchId || app.branches[0]?.id || "",
          currency: "RMB",
          distributionBasis: "weight",
          openedDate: "",
          expectedArrivalDate: "",
          actualArrivalDate: "",
          notes: "",
          lines: [{ variationId: "", quantity: undefined as unknown as number, unitWeight: 0, unitPriceForeign: undefined as unknown as number }],
        },
  })
  const { fields, append, remove } = useFieldArray({ control, name: "lines" })
  const lines = useWatch({ control, name: "lines" }) ?? []
  const currency = useWatch({ control, name: "currency" }) ?? "RMB"
  const lcValue = n(useWatch({ control, name: "lcValue" }))
  const rate = n(useWatch({ control, name: "exchangeRate" }))
  const e = formState.errors

  const totals = lines.reduce(
    (a, l) => ({
      qty: a.qty + n(l?.quantity),
      weight: a.weight + n(l?.quantity) * n(l?.unitWeight),
      value: a.value + n(l?.quantity) * n(l?.unitPriceForeign),
    }),
    { qty: 0, weight: 0, value: 0 },
  )
  const valueMismatch = totals.value > 0 && lcValue > 0 && Math.abs(totals.value - lcValue) > 0.005

  const onSubmit = handleSubmit(async (v) => {
    try {
      if (lc) {
        await api.patch(`/api/v1/lc/${lc.id}`, v)
        toast.success("LC updated")
        router.push(`/app/lc/${lc.id}`)
      } else {
        const res = await api.post<{ id: string }>("/api/v1/lc", v)
        toast.success(`LC ${v.lcNumber} created`)
        router.push(`/app/lc/${res.id}`)
      }
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  // react-hook-form keys fields by a generated id; keep the picked variation per index in sync on remove
  const removeLine = (i: number) => {
    remove(i)
    setVariations((prev) => {
      const next: Record<number, VariationOption | null> = {}
      Object.entries(prev).forEach(([k, val]) => {
        const idx = Number(k)
        if (idx < i) next[idx] = val
        else if (idx > i) next[idx - 1] = val
      })
      return next
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Section title="LC details" description="Who, which bank, and the commercial value in foreign currency.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Supplier" error={e.supplierId?.message} required>
            <SupplierPicker
              value={supplier}
              onChange={(s) => {
                setSupplier(s)
                setValue("supplierId", s?.id ?? "", { shouldValidate: formState.isSubmitted })
                if (s && (s.currency === "RMB" || s.currency === "USD")) setValue("currency", s.currency)
              }}
            />
          </Field>
          <Field label="LC number" htmlFor="lcNumber" error={e.lcNumber?.message} required hint="Unique within your company">
            <Input id="lcNumber" placeholder="e.g. LC-2026-0091" className="num" {...register("lcNumber")} />
          </Field>
          <Field label="Issuing bank" htmlFor="issuingBank" error={e.issuingBank?.message} required>
            <Input id="issuingBank" placeholder="e.g. Dutch-Bangla Bank, Motijheel" {...register("issuingBank")} />
          </Field>
          <Field label="Receiving branch" error={e.branchId?.message} required hint="Where the goods will be received into stock">
            <Controller
              control={control}
              name="branchId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
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
                    {LC_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "RMB" ? "RMB — Chinese yuan" : "USD — US dollar"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label={`LC value (${currency})`}
            htmlFor="lcValue"
            error={e.lcValue?.message}
            required
            hint={
              valueMismatch ? (
                <span className="text-warning">
                  Lines total {foreign(totals.value, currency)}.{" "}
                  <button type="button" className="font-medium underline" onClick={() => setValue("lcValue", Number(totals.value.toFixed(4)))}>
                    Use it
                  </button>
                </span>
              ) : undefined
            }
          >
            <Input id="lcValue" type="number" step="0.0001" min="0" className="num" {...register("lcValue")} />
          </Field>
          <Field
            label={`Exchange rate (1 ${currency} = ? BDT)`}
            htmlFor="exchangeRate"
            error={e.exchangeRate?.message}
            hint="Can be updated until the cost is finalized"
          >
            <Input id="exchangeRate" type="number" step="0.000001" min="0" className="num" {...register("exchangeRate")} />
          </Field>
          <Field label="Opened on" htmlFor="openedDate" error={e.openedDate?.message}>
            <Input id="openedDate" type="date" {...register("openedDate")} />
          </Field>
          <Field label="Expected arrival" htmlFor="expectedArrivalDate" error={e.expectedArrivalDate?.message}>
            <Input id="expectedArrivalDate" type="date" {...register("expectedArrivalDate")} />
          </Field>
          <Field label="Cost distribution basis" error={e.distributionBasis?.message} className="sm:col-span-2 lg:col-span-3" hint="You can compare both bases on the LC before finalizing.">
            <Controller control={control} name="distributionBasis" render={({ field }) => <BasisChoice value={field.value ?? "weight"} onChange={field.onChange} />} />
          </Field>
          <Field label="Notes" htmlFor="notes" error={e.notes?.message} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="notes" rows={3} placeholder="PI number, shipping line, B/L, anything useful…" {...register("notes")} />
          </Field>
        </div>
      </Section>

      <Section
        title="Product lines"
        description="What is being imported on this LC. Unit weight drives weight-based cost distribution."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ variationId: "", quantity: undefined as unknown as number, unitWeight: 0, unitPriceForeign: undefined as unknown as number })}
          >
            <Plus /> Add line
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="hidden grid-cols-[minmax(0,2.6fr)_1fr_1fr_1fr_1.1fr_auto] gap-3 px-1 text-xs font-medium text-muted-foreground lg:grid">
            <span>Product</span>
            <span className="text-right">Quantity</span>
            <span className="text-right">Unit weight (kg)</span>
            <span className="text-right">Unit price ({currency})</span>
            <span className="text-right">Line value</span>
            <span className="w-8" />
          </div>
          {fields.map((f, i) => {
            const l = lines[i]
            const le = e.lines?.[i]
            const lineValue = n(l?.quantity) * n(l?.unitPriceForeign)
            return (
              <div
                key={f.id}
                className="grid grid-cols-2 items-start gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,2.6fr)_1fr_1fr_1fr_1.1fr_auto] lg:border-0 lg:p-1"
              >
                <Field label={<span className="lg:hidden">Product</span>} error={le?.variationId?.message} className="col-span-2 lg:col-span-1 [&>label]:lg:hidden">
                  <VariationPicker
                    branchId={getValues("branchId") || undefined}
                    value={variations[i] ?? null}
                    onChange={(v) => {
                      setVariations((p) => ({ ...p, [i]: v }))
                      setValue(`lines.${i}.variationId`, v?.id ?? "", { shouldValidate: formState.isSubmitted })
                      if (v && !n(getValues(`lines.${i}.unitWeight`))) setValue(`lines.${i}.unitWeight`, v.unitWeight)
                    }}
                  />
                </Field>
                <Field label={<span className="lg:hidden">Quantity</span>} error={le?.quantity?.message} className="[&>label]:lg:hidden">
                  <Input type="number" step="0.001" min="0" className="num text-right" aria-label="Quantity" {...register(`lines.${i}.quantity`)} />
                </Field>
                <Field label={<span className="lg:hidden">Unit weight (kg)</span>} error={le?.unitWeight?.message} className="[&>label]:lg:hidden">
                  <Input type="number" step="0.0001" min="0" className="num text-right" aria-label="Unit weight in kg" {...register(`lines.${i}.unitWeight`)} />
                </Field>
                <Field label={<span className="lg:hidden">Unit price ({currency})</span>} error={le?.unitPriceForeign?.message} className="[&>label]:lg:hidden">
                  <Input type="number" step="0.0001" min="0" className="num text-right" aria-label="Unit price" {...register(`lines.${i}.unitPriceForeign`)} />
                </Field>
                <div className="grid gap-1.5">
                  <span className="text-[13px] font-medium lg:hidden">Line value</span>
                  <p className="num flex h-9 items-center justify-end text-sm font-medium">{foreign(lineValue, currency)}</p>
                </div>
                <div className="col-span-2 flex justify-end lg:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => removeLine(i)}
                    aria-label="Remove line"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )
          })}
          {e.lines?.message && <p className="text-xs font-medium text-destructive">{e.lines.message}</p>}
          {e.lines?.root?.message && <p className="text-xs font-medium text-destructive">{e.lines.root.message}</p>}
          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Qty <span className="num font-medium text-foreground">{totals.qty.toLocaleString("en-IN")}</span>
            </span>
            <span className="text-muted-foreground">
              Weight <span className="num font-medium text-foreground">{kg(totals.weight)}</span>
            </span>
            <span className="text-muted-foreground">
              Value <span className="num font-medium text-foreground">{foreign(totals.value, currency)}</span>
            </span>
            {rate > 0 && (
              <span className="text-muted-foreground">
                ≈ <span className="num font-medium text-foreground">৳ {(totals.value * rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              </span>
            )}
          </div>
        </div>
      </Section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" asChild>
          <Link href={lc ? `/app/lc/${lc.id}` : "/app/lc"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {lc ? "Save changes" : "Create LC"}
        </Button>
      </div>
    </form>
  )
}

type LockedInput = z.input<typeof lcLockedSchema>
type LockedOutput = z.output<typeof lcLockedSchema>

/** After goods are received: only rate, basis, arrival date and notes may change (LC-07). */
export function LcLockedForm({ lc }: { lc: LcFormValue }) {
  const router = useRouter()
  const closed = lc.status === "closed"
  const { register, handleSubmit, formState, setError, control } = useForm<LockedInput, unknown, LockedOutput>({
    resolver: zodResolver(lcLockedSchema),
    defaultValues: {
      exchangeRate: lc.exchangeRate,
      distributionBasis: lc.distributionBasis,
      actualArrivalDate: lc.actualArrivalDate ?? "",
      notes: lc.notes ?? "",
    },
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.patch(`/api/v1/lc/${lc.id}`, v)
      toast.success("LC updated")
      router.push(`/app/lc/${lc.id}`)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/8 p-4 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          Goods for this LC have been received (<LcStatusBadge status={lc.status} />
          ), so the supplier, LC value and product lines are locked.{" "}
          {closed
            ? "The LC is closed — only notes can be changed."
            : "You can still correct the exchange rate and cost items; recalculate the landed cost afterwards to apply them."}
        </p>
      </div>
      <Section title="Locked details">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Supplier</dt>
            <dd className="font-medium">{lc.supplier.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Issuing bank</dt>
            <dd className="font-medium">{lc.issuingBank}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">LC value</dt>
            <dd className="num font-medium">{foreign(lc.lcValue, lc.currency)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Product lines</dt>
            <dd className="font-medium">{lc.lines.length}</dd>
          </div>
        </dl>
      </Section>
      <Section title="Editable">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Exchange rate (1 ${lc.currency} = ? BDT)`} htmlFor="exchangeRate" error={e.exchangeRate?.message}>
            <Input id="exchangeRate" type="number" step="0.000001" min="0" className="num" disabled={closed} {...register("exchangeRate")} />
          </Field>
          <Field label="Actual arrival" htmlFor="actualArrivalDate" error={e.actualArrivalDate?.message}>
            <Input id="actualArrivalDate" type="date" disabled={closed} {...register("actualArrivalDate")} />
          </Field>
          <Field label="Cost distribution basis" className="sm:col-span-2">
            <Controller
              control={control}
              name="distributionBasis"
              render={({ field }) => <BasisChoice value={field.value ?? "weight"} onChange={field.onChange} disabled={closed} />}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" error={e.notes?.message} className="sm:col-span-2">
            <Textarea id="notes" rows={4} {...register("notes")} />
          </Field>
        </div>
      </Section>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" asChild>
          <Link href={`/app/lc/${lc.id}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  )
}
