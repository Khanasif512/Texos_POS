"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { addDays, format } from "date-fns"
import { Loader2, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApp, useCan } from "@/components/app/app-context"
import { Field } from "@/components/shared/field"
import { CustomerPicker, VariationPicker, type CustomerOption, type VariationOption } from "@/components/shared/pickers"
import { ApiError, api, errorMessage } from "@/lib/api-client"
import { money, quantity } from "@/lib/format"
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/validation/sales-after"

export type OrderLineDraft = { key: string; variation: VariationOption | null; quantity: string; unitPrice: string; discount: string }
export type OrderDraft = {
  id?: string
  number?: string
  type: "quotation" | "order"
  branchId: string
  customer: CustomerOption | null
  date: string
  validUntil: string
  discount: string
  note: string
  lines: OrderLineDraft[]
  advanceAmount?: number
}

const newLine = (): OrderLineDraft => ({ key: crypto.randomUUID(), variation: null, quantity: "1", unitPrice: "", discount: "" })
const r2 = (n: number) => Math.round(n * 100) / 100

export function emptyDraft(type: "quotation" | "order", branchId: string): OrderDraft {
  const today = new Date()
  return {
    type,
    branchId,
    customer: null,
    date: format(today, "yyyy-MM-dd"),
    validUntil: type === "quotation" ? format(addDays(today, 15), "yyyy-MM-dd") : "",
    discount: "",
    note: "",
    lines: [newLine()],
  }
}

export function OrderForm({ initial }: { initial: OrderDraft }) {
  const app = useApp()
  const router = useRouter()
  const canAdvance = useCan("sales.receipt")
  const editing = !!initial.id
  const [d, setD] = useState<OrderDraft>(initial)
  const [advance, setAdvance] = useState({ amount: "", method: "cash", reference: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const isOrder = d.type === "order"
  const label = isOrder ? "sales order" : "quotation"

  const setLine = (key: string, patch: Partial<OrderLineDraft>) => setD((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  const lineTotal = (l: OrderLineDraft) => r2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) - (Number(l.discount) || 0))
  const subtotal = r2(d.lines.reduce((a, l) => a + lineTotal(l), 0))
  const total = r2(subtotal - (Number(d.discount) || 0))

  const pickVariation = (key: string, v: VariationOption | null) => {
    const wholesale = d.customer && d.customer.type !== "retail" && v?.wholesalePrice != null
    setLine(key, { variation: v, unitPrice: v ? String(wholesale ? v.wholesalePrice : v.salePrice) : "" })
  }

  const submit = async () => {
    const errs: Record<string, string> = {}
    if (isOrder && !d.customer) errs.customerId = "A sales order needs a customer"
    const filled = d.lines.filter((l) => l.variation)
    if (!filled.length) errs.lines = "Add at least one item"
    d.lines.forEach((l, i) => {
      if (l.variation && !(Number(l.quantity) > 0)) errs[`lines.${i}.quantity`] = "Enter a quantity"
      if (l.variation && lineTotal(l) < 0) errs[`lines.${i}.discount`] = "Discount exceeds the line"
    })
    if (total < 0) errs.discount = "Discount exceeds the subtotal"
    if (advance.amount && !(Number(advance.amount) > 0)) errs["advance.amount"] = "Enter a valid amount"
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const body = {
      type: d.type,
      branchId: d.branchId,
      customerId: d.customer?.id ?? null,
      date: d.date,
      validUntil: d.validUntil || null,
      discount: Number(d.discount) || 0,
      note: d.note,
      lines: filled.map((l) => ({ variationId: l.variation!.id, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) || 0, discount: Number(l.discount) || 0 })),
      advance: !editing && isOrder && Number(advance.amount) > 0 ? { amount: Number(advance.amount), method: advance.method, reference: advance.reference, date: d.date } : null,
    }
    try {
      if (editing) {
        await api.patch(`/api/v1/sales-orders/${d.id}`, body)
        toast.success(`${d.number} updated`)
        router.push(`/app/sales/orders/${d.id}`)
        router.refresh()
      } else {
        const r = await api.post<{ id: string; number: string; advanceReceipt: { number: string } | null }>("/api/v1/sales-orders", body, { idempotencyKey })
        toast.success(`${isOrder ? "Order" : "Quotation"} ${r.number} saved`, r.advanceReceipt ? { description: `Advance receipt ${r.advanceReceipt.number}` } : undefined)
        router.push(`/app/sales/orders/${r.id}`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields) {
        // server line indexes refer to filled lines only
        const map: Record<string, string> = {}
        for (const [k, v] of Object.entries(err.details.fields)) {
          const m = k.match(/^lines\.(\d+)\.(\w+)$/)
          if (m) {
            const idx = d.lines.indexOf(filled[Number(m[1])])
            map[`lines.${idx}.${m[2]}`] = v
          } else map[k] = v
        }
        setErrors(map)
      }
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          <Field label="Customer" error={errors.customerId} required={isOrder} hint={isOrder ? undefined : "Optional for a quotation"} className="sm:col-span-2">
            <CustomerPicker value={d.customer} onChange={(c) => setD((s) => ({ ...s, customer: c }))} disabled={editing && (initial.advanceAmount ?? 0) > 0} />
          </Field>
          <Field label="Date" htmlFor="so-date" required error={errors.date}>
            <Input id="so-date" type="date" value={d.date} onChange={(e) => setD((s) => ({ ...s, date: e.target.value }))} />
          </Field>
          <Field label={isOrder ? "Delivery / valid until" : "Valid until"} htmlFor="so-valid" error={errors.validUntil}>
            <Input id="so-valid" type="date" value={d.validUntil} min={d.date} onChange={(e) => setD((s) => ({ ...s, validUntil: e.target.value }))} />
          </Field>
          {app.branches.length > 1 && (
            <Field label="Branch" required hint={editing ? "Fixed after creation" : "Prices and stock are shown for this branch"}>
              <Select value={d.branchId} onValueChange={(v) => setD((s) => ({ ...s, branchId: v }))} disabled={editing}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {app.branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="font-semibold">Items</h2>
            <Button variant="outline" size="sm" onClick={() => setD((s) => ({ ...s, lines: [...s.lines, newLine()] }))}>
              <Plus /> Add item
            </Button>
          </div>
          <div className="divide-y">
            {d.lines.map((l, i) => (
              <div key={l.key} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_90px_120px_100px_110px_36px] sm:items-start">
                <Field label={i === 0 ? "Product" : undefined} className="min-w-0">
                  <VariationPicker branchId={d.branchId} value={l.variation} onChange={(v) => pickVariation(l.key, v)} />
                  {l.variation && (
                    <p className="text-xs text-muted-foreground">
                      {l.variation.sku} · stock {quantity(l.variation.stock)} {l.variation.unit}
                    </p>
                  )}
                </Field>
                <Field label={i === 0 ? "Qty" : undefined} error={errors[`lines.${i}.quantity`]}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="num text-right"
                    aria-label="Quantity"
                    value={l.quantity}
                    onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                  />
                </Field>
                <Field label={i === 0 ? "Unit price" : undefined} error={errors[`lines.${i}.unitPrice`]}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="num text-right"
                    aria-label="Unit price"
                    value={l.unitPrice}
                    onChange={(e) => setLine(l.key, { unitPrice: e.target.value })}
                  />
                </Field>
                <Field label={i === 0 ? "Discount" : undefined} error={errors[`lines.${i}.discount`]}>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="num text-right"
                    aria-label="Line discount"
                    placeholder="0"
                    value={l.discount}
                    onChange={(e) => setLine(l.key, { discount: e.target.value })}
                  />
                </Field>
                <Field label={i === 0 ? "Amount" : undefined}>
                  <p className="num flex h-9 items-center justify-end font-medium">{money(lineTotal(l))}</p>
                </Field>
                <div className={i === 0 ? "sm:pt-6" : ""}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove item"
                    disabled={d.lines.length === 1}
                    onClick={() => setD((s) => ({ ...s, lines: s.lines.filter((x) => x.key !== l.key) }))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {errors.lines && <p className="px-5 pb-3 text-xs font-medium text-destructive">{errors.lines}</p>}
        </section>

        <Field label="Note / terms" htmlFor="so-note">
          <Textarea
            id="so-note"
            rows={3}
            value={d.note}
            onChange={(e) => setD((s) => ({ ...s, note: e.target.value }))}
            placeholder={isOrder ? "Delivery instructions, site address…" : "Payment terms, delivery time, installation…"}
          />
        </Field>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Total</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="num">{money(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Discount</dt>
              <dd>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  aria-label="Order discount"
                  aria-invalid={!!errors.discount || undefined}
                  className="num h-8 w-[120px] text-right"
                  placeholder="0.00"
                  value={d.discount}
                  onChange={(e) => setD((s) => ({ ...s, discount: e.target.value }))}
                />
              </dd>
            </div>
            {errors.discount && <p className="text-right text-xs text-destructive">{errors.discount}</p>}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="num">{money(total)}</dd>
            </div>
          </dl>
        </section>

        {isOrder && !editing && canAdvance && (
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <div>
              <h2 className="font-semibold">Advance payment</h2>
              <p className="text-xs text-muted-foreground">Optional. Saved as an advance money receipt and credited to the customer.</p>
            </div>
            <Field label="Amount" error={errors["advance.amount"]}>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="num"
                placeholder="0.00"
                value={advance.amount}
                onChange={(e) => setAdvance((a) => ({ ...a, amount: e.target.value }))}
              />
            </Field>
            {Number(advance.amount) > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Method">
                  <Select value={advance.method} onValueChange={(v) => setAdvance((a) => ({ ...a, method: v }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reference">
                  <Input value={advance.reference} onChange={(e) => setAdvance((a) => ({ ...a, reference: e.target.value }))} maxLength={120} />
                </Field>
              </div>
            )}
          </section>
        )}

        <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Save />} {editing ? "Save changes" : `Save ${label}`}
        </Button>
      </aside>
    </div>
  )
}
