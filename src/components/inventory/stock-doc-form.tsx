"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/shared/field"
import { VariationPicker, type VariationOption } from "@/components/shared/pickers"
import { useApp } from "@/components/app/app-context"
import { ApiError, api, errorMessage } from "@/lib/api-client"
import { amount, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ADJUSTMENT_REASONS, adjustmentSchema, openingStockSchema, transferSchema } from "@/lib/validation/inventory"

type Mode = "adjustment" | "opening" | "transfer"
type Line = { key: string; variation: VariationOption | null; quantity: string; unitCost: string }
type Errors = Record<string, string>

const newLine = (): Line => ({ key: crypto.randomUUID(), variation: null, quantity: "", unitCost: "" })
const num = (v: string) => {
  const n = Number(v)
  return v.trim() !== "" && Number.isFinite(n) ? n : 0
}

const CONFIG = {
  adjustment: { endpoint: "/api/v1/stock-adjustments", schema: adjustmentSchema, submit: "Post adjustment", detail: "/app/inventory/adjustments" },
  opening: { endpoint: "/api/v1/inventory/opening", schema: openingStockSchema, submit: "Post opening stock", detail: null },
  transfer: { endpoint: "/api/v1/stock-transfers", schema: transferSchema, submit: "Dispatch transfer", detail: "/app/inventory/transfers" },
} as const

/**
 * Line-item form for stock documents: adjustments (signed qty, optional cost on + lines),
 * opening stock (qty + cost, bulk entry) and transfers (qty only).
 * Keyboard: pick a product → Enter in the last field adds a row and opens its product search.
 */
export function StockDocForm({ mode, today, destinations }: { mode: Mode; today: string; destinations?: { id: string; name: string }[] }) {
  const router = useRouter()
  const app = useApp()
  const cfg = CONFIG[mode]
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID())
  const [branchId, setBranchId] = useState(app.activeBranchId)
  const [toBranchId, setToBranchId] = useState("")
  const [reason, setReason] = useState("")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [lines, setLines] = useState<Line[]>(() => (mode === "opening" ? [newLine(), newLine(), newLine()] : [newLine()]))
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const tableRef = useRef<HTMLTableSectionElement>(null)
  const withCost = mode !== "transfer"

  const patch = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const focusField = (i: number, field: string) =>
    setTimeout(() => tableRef.current?.querySelector<HTMLElement>(`[data-row="${i}"] [data-field="${field}"]`)?.focus(), 60)
  const addRow = (open = true) => {
    const i = lines.length
    setLines((ls) => [...ls, newLine()])
    if (open)
      setTimeout(() => {
        const btn = tableRef.current?.querySelector<HTMLButtonElement>(`[data-row="${i}"] button[role="combobox"]`)
        btn?.focus()
        btn?.click()
      }, 60)
  }
  const onEnter = (i: number, last: boolean) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (!last) return focusField(i, "unitCost")
    if (i === lines.length - 1) addRow()
    else focusField(i + 1, "quantity")
  }

  const filled = lines.filter((l) => l.variation || l.quantity.trim() || l.unitCost.trim())
  const totalIn = filled.reduce((a, l) => a + Math.max(0, num(l.quantity)), 0)
  const totalOut = filled.reduce((a, l) => a + Math.max(0, -num(l.quantity)), 0)
  const value = filled.reduce((a, l) => a + (num(l.quantity) > 0 ? num(l.quantity) * num(l.unitCost) : 0), 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const indexMap = filled.map((l) => lines.indexOf(l))
    const body = {
      ...(mode === "transfer" ? { fromBranchId: branchId, toBranchId } : { branchId }),
      ...(mode === "adjustment" ? { reason } : {}),
      date,
      note,
      lines: filled.map((l) => ({
        variationId: l.variation?.id ?? "",
        quantity: l.quantity,
        ...(withCost ? { unitCost: l.unitCost } : {}),
      })),
    }
    const parsed = cfg.schema.safeParse(body)
    const toErrors = (issues: { path: PropertyKey[]; message: string }[] | Record<string, string>) => {
      const out: Errors = {}
      const entries = Array.isArray(issues) ? issues.map((i) => [i.path.map(String).join("."), i.message] as const) : Object.entries(issues)
      for (const [path, msg] of entries) {
        const m = /^lines\.(\d+)\.(\w+)/.exec(path)
        const key = m ? `lines.${indexMap[Number(m[1])]}.${m[2]}` : path
        out[key] ??= msg
      }
      return out
    }
    if (!parsed.success) {
      setErrors(toErrors(parsed.error.issues))
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const res = await api.post<{ id?: string; number?: string; lines?: number }>(cfg.endpoint, parsed.data, { idempotencyKey: idemKey })
      if (mode === "opening") {
        toast.success(`Opening stock posted: ${res.lines} item(s)`)
        setLines([newLine(), newLine(), newLine()])
        setIdemKey(crypto.randomUUID())
        router.refresh()
      } else {
        toast.success(`${res.number} ${mode === "transfer" ? "dispatched" : "posted"}`)
        router.push(`${cfg.detail}/${res.id}`)
        router.refresh()
      }
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields) setErrors(toErrors(err.details.fields))
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const branchSelect = (value: string, onChange: (v: string) => void, options: { id: string; name: string }[], placeholder: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={mode === "transfer" ? "From branch" : "Branch"} error={errors.branchId ?? errors.fromBranchId} required>
          {branchSelect(branchId, setBranchId, app.branches, "Choose a branch")}
        </Field>
        {mode === "transfer" && (
          <Field label="To branch" error={errors.toBranchId} required>
            {branchSelect(toBranchId, setToBranchId, (destinations ?? []).filter((b) => b.id !== branchId), "Choose destination")}
          </Field>
        )}
        {mode === "adjustment" && (
          <Field label="Reason" error={errors.reason} required>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Date" htmlFor="doc-date" error={errors.date} required>
          <Input id="doc-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="doc-note" error={errors.note} required={mode === "adjustment" && reason === "other"} className={mode === "opening" ? "sm:col-span-2" : undefined}>
          <Input id="doc-note" value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder={mode === "opening" ? "e.g. Stock count on migration day" : "Optional"} />
        </Field>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Items</h2>
            <p className="text-xs text-muted-foreground">
              {mode === "adjustment"
                ? "Positive quantity adds stock, negative removes it (oldest batches first)."
                : mode === "opening"
                  ? "Tip: press Enter in the cost field to add the next row."
                  : "Stock leaves the source branch when you dispatch; it arrives when the destination receives it."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
            <Plus /> Add row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2.5 font-medium">#</th>
                <th className="px-2 py-2.5 font-medium">Product</th>
                <th className="w-24 px-2 py-2.5 text-right font-medium">In stock</th>
                <th className="w-32 px-2 py-2.5 text-right font-medium">{mode === "adjustment" ? "Change (±)" : "Quantity"}</th>
                {withCost && <th className="w-36 px-2 py-2.5 text-right font-medium">Unit cost (৳)</th>}
                <th className="w-10 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody ref={tableRef} className="divide-y">
              {lines.map((l, i) => {
                const q = num(l.quantity)
                const costEnabled = mode === "opening" || (mode === "adjustment" && q > 0)
                const err = (f: string) => errors[`lines.${i}.${f}`]
                return (
                  <tr key={l.key} data-row={i} className="align-top">
                    <td className="num px-3 py-4 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2.5">
                      <VariationPicker
                        value={l.variation}
                        branchId={branchId || undefined}
                        onChange={(v) => {
                          patch(i, { variation: v })
                          if (v) focusField(i, "quantity")
                        }}
                      />
                      {err("variationId") && <p className="mt-1 text-xs font-medium text-destructive">{err("variationId")}</p>}
                    </td>
                    <td className="num px-2 py-4 text-right text-muted-foreground">
                      {l.variation ? `${quantity(l.variation.stock)} ${l.variation.unit}` : "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        data-field="quantity"
                        type="number"
                        step="0.001"
                        inputMode="decimal"
                        className={cn("num h-9 text-right", mode === "adjustment" && q < 0 && "text-destructive", mode === "adjustment" && q > 0 && "text-success")}
                        aria-label="Quantity"
                        aria-invalid={!!err("quantity")}
                        value={l.quantity}
                        onChange={(e) => patch(i, { quantity: e.target.value })}
                        onKeyDown={onEnter(i, !costEnabled)}
                      />
                      {err("quantity") && <p className="mt-1 text-xs font-medium text-destructive">{err("quantity")}</p>}
                    </td>
                    {withCost && (
                      <td className="px-2 py-2.5">
                        <Input
                          data-field="unitCost"
                          type="number"
                          step="0.0001"
                          min="0"
                          inputMode="decimal"
                          className="num h-9 text-right"
                          aria-label="Unit cost"
                          disabled={!costEnabled}
                          placeholder={mode === "adjustment" ? (q > 0 ? "Last cost" : "FIFO") : "0.00"}
                          aria-invalid={!!err("unitCost")}
                          value={costEnabled ? l.unitCost : ""}
                          onChange={(e) => patch(i, { unitCost: e.target.value })}
                          onKeyDown={onEnter(i, true)}
                        />
                        {err("unitCost") && <p className="mt-1 text-xs font-medium text-destructive">{err("unitCost")}</p>}
                      </td>
                    )}
                    <td className="px-2 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove row ${i + 1}`}
                        disabled={lines.length === 1}
                        onClick={() => {
                          setLines((ls) => ls.filter((_, j) => j !== i))
                          setErrors({})
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
        {errors.lines && <p className="border-t px-5 py-2 text-xs font-medium text-destructive">{errors.lines}</p>}
        <div className="flex flex-col items-end gap-1 border-t bg-muted/20 px-5 py-4 text-sm">
          <p className="text-muted-foreground">
            {filled.length} line(s) ·{" "}
            {mode === "adjustment" ? (
              <>
                <span className="num text-success">+{quantity(totalIn)}</span> / <span className="num text-destructive">−{quantity(totalOut)}</span> units
              </>
            ) : (
              <span className="num text-foreground">{quantity(totalIn)} units</span>
            )}
          </p>
          {mode === "opening" && (
            <p className="text-base font-semibold">
              Value <span className="num ml-2">{money(value)}</span>
            </p>
          )}
          {mode === "adjustment" && value > 0 && <p className="text-xs text-muted-foreground">Entered value of additions ৳{amount(value)}</p>}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {mode !== "opening" && (
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : mode === "transfer" && <ArrowRight />} {cfg.submit}
        </Button>
      </div>
    </form>
  )
}
