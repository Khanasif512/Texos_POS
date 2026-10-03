"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Loader2, PackageCheck, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AsyncCombobox } from "@/components/shared/async-combobox"
import { Field } from "@/components/shared/field"
import { StatusBadge } from "@/components/shared/status-badge"
import { ApiError, api, errorMessage } from "@/lib/api-client"
import { date, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ReturnableInvoice } from "@/server/modules/sales-after/returns"

type InvoiceOption = { id: string; number: string; date: string; customerName: string; total: number; type: string; status: string }

const MODE_TEXT = {
  credit_note: { title: "Credit note", text: "Credits the customer's account; reduces this invoice's due first." },
  cash: { title: "Cash refund", text: "Pay the money back from the counter on approval." },
} as const

export function ReturnForm({ initial }: { initial: ReturnableInvoice | null }) {
  const router = useRouter()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [picked, setPicked] = useState<InvoiceOption | null>(
    initial ? { id: initial.id, number: initial.number, date: initial.date, customerName: initial.customerName, total: initial.total, type: initial.type, status: initial.status } : null,
  )
  const [inv, setInv] = useState<ReturnableInvoice | null>(initial)
  const [loading, setLoading] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [reason, setReason] = useState("")
  const [restock, setRestock] = useState(true)
  const [mode, setMode] = useState<string>(initial?.refundModes[0] ?? "credit_note")
  const [day, setDay] = useState(format(new Date(), "yyyy-MM-dd"))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const pick = async (o: InvoiceOption | null) => {
    setPicked(o)
    setInv(null)
    setQty({})
    setErrors({})
    if (!o) return
    setLoading(true)
    try {
      const d = await api.get<ReturnableInvoice>(`/api/v1/returns/invoices/${o.id}`)
      setInv(d)
      setMode(d.refundModes[0])
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const lines = inv?.lines ?? []
  const chosen = lines.filter((l) => Number(qty[l.id]) > 0)
  const estimate = (l: ReturnableInvoice["lines"][number], q: number) => (l.quantity > 0 ? (l.lineTotal * (inv?.factor ?? 1) * q) / l.quantity : 0)
  const total = chosen.reduce((a, l) => a + estimate(l, Number(qty[l.id])), 0)

  const submit = async () => {
    const errs: Record<string, string> = {}
    if (!inv) errs.invoiceId = "Choose an invoice"
    if (!chosen.length) errs.lines = "Enter a quantity for at least one item"
    lines.forEach((l, i) => {
      if (Number(qty[l.id]) > l.returnable) errs[`line.${i}`] = `Max ${quantity(l.returnable)}`
    })
    if (reason.trim().length < 3) errs.reason = "Give a reason for the return"
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const r = await api.post<{ id: string; number: string }>(
        "/api/v1/returns",
        { invoiceId: inv!.id, date: day, reason, restock, refundMode: mode, lines: chosen.map((l) => ({ invoiceLineId: l.id, quantity: Number(qty[l.id]) })) },
        { idempotencyKey },
      )
      toast.success(`Return ${r.number} sent for approval`)
      router.push(`/app/sales/returns/${r.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields) {
        const f = { ...err.details.fields }
        for (const [k, v] of Object.entries(err.details.fields)) {
          const m = k.match(/^lines\.(\d+)\.quantity$/)
          if (m) {
            const line = chosen[Number(m[1])]
            const idx = lines.findIndex((l) => l.id === line?.id)
            if (idx >= 0) f[`line.${idx}`] = v
          }
        }
        setErrors(f)
      }
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <Field label="Invoice" error={errors.invoiceId} required hint="Search by invoice number, customer name or phone.">
            <AsyncCombobox<InvoiceOption>
              endpoint="/api/v1/returns/invoices"
              value={picked}
              onChange={pick}
              placeholder="Find the invoice…"
              renderValue={(o) => `${o.number} — ${o.customerName}`}
              renderItem={(o) => (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="num text-sm">{o.number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.customerName} · {date(o.date)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="num">{money(o.total)}</p>
                    <p className="text-muted-foreground capitalize">{o.type}</p>
                  </div>
                </div>
              )}
            />
          </Field>
          {inv && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-muted/50 px-4 py-3 text-sm">
              <span>
                <span className="text-muted-foreground">Customer </span>
                {inv.customerName}
              </span>
              <span className="capitalize">
                <span className="text-muted-foreground">Type </span>
                {inv.type}
              </span>
              <span>
                <span className="text-muted-foreground">Total </span>
                <span className="num">{money(inv.total)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Due </span>
                <span className="num">{money(inv.dueAmount)}</span>
              </span>
              {inv.returnedAmount > 0 && (
                <span>
                  <span className="text-muted-foreground">Already returned </span>
                  <span className="num">{money(inv.returnedAmount)}</span>
                </span>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5">
            <h2 className="font-semibold">Items to return</h2>
            <p className="text-xs text-muted-foreground">Up to what was sold, less earlier returns and requests still awaiting approval.</p>
          </div>
          {!picked ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Choose an invoice first.</p>
          ) : loading || !inv ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-right text-xs">Sold</TableHead>
                    <TableHead className="text-right text-xs">Price</TableHead>
                    <TableHead className="text-right text-xs">Returnable</TableHead>
                    <TableHead className="w-[150px] text-right text-xs">Return qty</TableHead>
                    <TableHead className="text-right text-xs">Refund (est.)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => {
                    const q = Number(qty[l.id]) || 0
                    return (
                      <TableRow key={l.id} className={cn(l.returnable <= 0 && "opacity-60")}>
                        <TableCell className="py-2.5">
                          <p className="font-medium">{l.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.variationName} · <span className="num">{l.sku}</span>
                            {l.returnedQty > 0 && <span className="text-warning"> · {quantity(l.returnedQty)} returned</span>}
                            {l.pendingQty > 0 && <span className="text-info"> · {quantity(l.pendingQty)} pending</span>}
                          </p>
                        </TableCell>
                        <TableCell className="num text-right">
                          {quantity(l.quantity)} <span className="text-xs text-muted-foreground">{l.unit}</span>
                        </TableCell>
                        <TableCell className="num text-right text-muted-foreground">{money(l.unitPrice)}</TableCell>
                        <TableCell className="num text-right">{quantity(l.returnable)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              max={l.returnable}
                              disabled={l.returnable <= 0}
                              aria-label={`Return quantity for ${l.productName}`}
                              aria-invalid={!!errors[`line.${i}`] || undefined}
                              className="num h-8 w-[90px] text-right"
                              value={qty[l.id] ?? ""}
                              placeholder="0"
                              onChange={(e) => setQty((s) => ({ ...s, [l.id]: e.target.value }))}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={l.returnable <= 0}
                              onClick={() => setQty((s) => ({ ...s, [l.id]: String(l.returnable) }))}
                            >
                              All
                            </Button>
                          </div>
                          {errors[`line.${i}`] && <p className="mt-1 text-xs text-destructive">{errors[`line.${i}`]}</p>}
                        </TableCell>
                        <TableCell className="num text-right">{q > 0 ? money(estimate(l, q)) : "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {errors.lines && <p className="px-5 py-2 text-xs font-medium text-destructive">{errors.lines}</p>}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <Field label="Reason" htmlFor="ret-reason" error={errors.reason} required>
            <Textarea id="ret-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Broken glass on delivery" maxLength={255} />
          </Field>
          <Field label="Return date" htmlFor="ret-date" required>
            <Input id="ret-date" type="date" value={day} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PackageCheck className="size-4" /> Put back in stock
              </p>
              <p className="text-xs text-muted-foreground">Off for damaged goods — they will not be resold.</p>
            </div>
            <Switch checked={restock} onCheckedChange={setRestock} />
          </label>
          <Field label="Refund as" error={errors.refundMode} required>
            <RadioGroup value={mode} onValueChange={setMode} className="gap-2">
              {(["credit_note", "cash"] as const).map((m) => {
                const allowed = !inv || inv.refundModes.includes(m)
                return (
                  <label
                    key={m}
                    className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3", mode === m && "border-primary bg-primary/5", !allowed && "cursor-not-allowed opacity-50")}
                  >
                    <RadioGroupItem value={m} disabled={!allowed} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{MODE_TEXT[m].title}</p>
                      <p className="text-xs text-muted-foreground">
                        {!allowed && inv
                          ? m === "credit_note"
                            ? "Needs a customer — walk-in sales are refunded in cash."
                            : "Not while this credit invoice still has dues."
                          : MODE_TEXT[m].text}
                      </p>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          </Field>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Estimated refund</span>
            <span className="num text-lg font-semibold">{money(total)}</span>
          </div>
          <Button size="lg" className="w-full" onClick={submit} disabled={busy || !inv}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Request approval
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <StatusBadge tone="warning">Pending</StatusBadge> Stock and money move only after a manager approves.
          </p>
        </section>
      </aside>
    </div>
  )
}
