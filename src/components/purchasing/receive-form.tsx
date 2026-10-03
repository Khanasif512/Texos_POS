"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/shared/field"
import { useApp } from "@/components/app/app-context"
import { ApiError, api, errorMessage } from "@/lib/api-client"
import { money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ReceivableLine = {
  id: string
  variationId: string
  productName: string
  variationName: string
  sku: string
  unit: string
  quantity: number
  receivedQty: number
  remaining: number
  unitCost: number | null
  costMissing?: boolean
}

export function ReceiveForm({
  source,
  sourceId,
  sourceLabel,
  defaultBranchId,
  lines,
  showCost,
  today,
  blocked,
}: {
  source: "po" | "lc"
  sourceId: string
  sourceLabel: string
  defaultBranchId: string
  lines: ReceivableLine[]
  showCost: boolean
  today: string
  blocked?: string | null
}) {
  const router = useRouter()
  const app = useApp()
  const [idemKey] = useState(() => crypto.randomUUID())
  const [branchId, setBranchId] = useState(app.branches.some((b) => b.id === defaultBranchId) ? defaultBranchId : app.activeBranchId)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.id, l.remaining > 0 ? String(l.remaining) : ""])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const open = lines.filter((l) => l.remaining > 0)
  const val = (id: string) => {
    const n = Number(qty[id])
    return Number.isFinite(n) ? n : 0
  }
  const totalQty = open.reduce((a, l) => a + val(l.id), 0)
  const totalValue = open.reduce((a, l) => a + val(l.id) * (l.unitCost ?? 0), 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    for (const l of open) {
      const n = val(l.id)
      if (n < 0) errs[l.id] = "Cannot be negative"
      else if (n > l.remaining) errs[l.id] = `Max ${quantity(l.remaining)}`
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (totalQty <= 0) return toast.error("Enter a quantity for at least one line")
    setBusy(true)
    try {
      const res = await api.post<{ id: string; number: string }>(
        "/api/v1/goods-receipts",
        { source, sourceId, branchId, date, note, lines: open.map((l) => ({ lineId: l.id, quantity: val(l.id) })).filter((l) => l.quantity > 0) },
        { idempotencyKey: idemKey },
      )
      toast.success(`${res.number} posted — stock updated`)
      router.push(`/app/purchases/receipts/${res.id}`)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields) {
        const fe: Record<string, string> = {}
        for (const [k, m] of Object.entries(err.details.fields)) {
          const i = /^lines\.(\d+)/.exec(k)?.[1]
          if (i != null && open[Number(i)]) fe[open[Number(i)].id] = m
        }
        setErrors(fe)
      }
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (blocked)
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-5 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <p className="font-medium">{sourceLabel} cannot be received yet</p>
          <p className="mt-1 text-muted-foreground">{blocked}</p>
          {source === "lc" && (
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link href={`/app/lc/${sourceId}`}>Open LC</Link>
            </Button>
          )}
        </div>
      </div>
    )

  if (open.length === 0)
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Everything on {sourceLabel} has already been received.
      </div>
    )

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-3">
        <Field label="Receive into branch" required>
          <Select value={branchId} onValueChange={setBranchId}>
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
        </Field>
        <Field label="Receipt date" htmlFor="grn-date" required>
          <Input id="grn-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="grn-note">
          <Input id="grn-note" value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Truck no., challan ref…" />
        </Field>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Items to receive</h2>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.id, l.remaining > 0 ? String(l.remaining) : ""])))}>
              Receive all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setQty({})}>
              Clear
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Product</th>
                <th className="px-3 py-2.5 text-right font-medium">Ordered</th>
                <th className="px-3 py-2.5 text-right font-medium">Already received</th>
                <th className="w-36 px-3 py-2.5 text-right font-medium">Receive now</th>
                {showCost && <th className="px-5 py-2.5 text-right font-medium">{source === "lc" ? "Landed unit cost" : "Unit cost"}</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l) => (
                <tr key={l.id} className={cn("align-top", l.remaining <= 0 && "opacity-50")}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{l.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.variationName} · {l.sku}
                    </p>
                  </td>
                  <td className="num px-3 py-3 text-right">
                    {quantity(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                  </td>
                  <td className="num px-3 py-3 text-right text-muted-foreground">{quantity(l.receivedQty)}</td>
                  <td className="px-3 py-2">
                    {l.remaining > 0 ? (
                      <>
                        <Input
                          type="number"
                          min="0"
                          max={l.remaining}
                          step="0.001"
                          inputMode="decimal"
                          className="num h-9 text-right"
                          aria-label={`Receive quantity for ${l.productName}`}
                          aria-invalid={!!errors[l.id]}
                          value={qty[l.id] ?? ""}
                          onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                        />
                        <p className={cn("mt-1 text-right text-xs", errors[l.id] ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {errors[l.id] ?? `of ${quantity(l.remaining)} open`}
                        </p>
                      </>
                    ) : (
                      <p className="py-2 text-right text-xs text-muted-foreground">Fully received</p>
                    )}
                  </td>
                  {showCost && (
                    <td className="num px-5 py-3 text-right">{l.costMissing ? <span className="text-destructive">Missing</span> : money(l.unitCost)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-end gap-1 border-t bg-muted/20 px-5 py-4 text-sm">
          <p className="text-muted-foreground">
            Receiving <span className="num text-foreground">{quantity(totalQty)}</span> units
          </p>
          {showCost && (
            <p className="text-base font-semibold">
              Value <span className="num ml-2">{money(totalValue)}</span>
            </p>
          )}
          {source === "po" && <p className="text-xs text-muted-foreground">The supplier payable is increased by this value.</p>}
          {source === "lc" && <p className="text-xs text-muted-foreground">Batches are costed at the current landed-cost snapshot.</p>}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || totalQty <= 0}>
          {busy && <Loader2 className="animate-spin" />} Post goods receipt
        </Button>
      </div>
    </form>
  )
}
