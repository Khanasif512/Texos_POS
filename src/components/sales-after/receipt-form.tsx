"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Loader2, Printer, Save, Sparkles, WalletCards } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApp } from "@/components/app/app-context"
import { Field } from "@/components/shared/field"
import { CustomerPicker, type CustomerOption } from "@/components/shared/pickers"
import { StatusBadge } from "@/components/shared/status-badge"
import { ApiError, api, errorMessage } from "@/lib/api-client"
import { date, money } from "@/lib/format"
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/validation/sales-after"
import type { CustomerDueSummary } from "@/server/modules/sales-after/receipts"
import { ApplyAdvanceButton } from "./apply-advance-button"

const paisa = (v: number | string) => Math.round((Number(v) || 0) * 100)
const taka = (p: number) => p / 100

/** Oldest-first allocation in paisa (display only — the server re-validates every allocation). */
function autoAllocate(amountPaisa: number, invoices: CustomerDueSummary["openInvoices"], first?: string) {
  const order = first ? [...invoices.filter((i) => i.id === first), ...invoices.filter((i) => i.id !== first)] : invoices
  let left = amountPaisa
  const out: Record<string, string> = {}
  for (const inv of order) {
    const due = paisa(inv.dueAmount)
    const take = Math.max(0, Math.min(due, left))
    out[inv.id] = take > 0 ? taka(take).toFixed(2) : ""
    left -= take
  }
  return out
}

const REF_LABEL: Record<string, string> = { cheque: "Cheque no. & bank", bank: "Bank / transaction ref.", mobile_banking: "Transaction ID", card: "Card slip / last 4 digits" }

export function ReceiptForm({ initialCustomer, invoiceId }: { initialCustomer: CustomerOption | null; invoiceId?: string }) {
  const app = useApp()
  const router = useRouter()
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [customer, setCustomer] = useState<CustomerOption | null>(initialCustomer)
  const [summary, setSummary] = useState<CustomerDueSummary | null>(null)
  const [loading, setLoading] = useState(!!initialCustomer)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [alloc, setAlloc] = useState<Record<string, string>>({})
  const [manual, setManual] = useState(false)
  const [branchId, setBranchId] = useState(app.activeBranchId)
  const [method, setMethod] = useState<string>("cash")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [day, setDay] = useState(format(new Date(), "yyyy-MM-dd"))
  const [busy, setBusy] = useState<false | "save" | "print">(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const apply = useCallback(
    (s: CustomerDueSummary, prefill: boolean) => {
      setSummary(s)
      if (prefill && invoiceId) {
        const inv = s.openInvoices.find((i) => i.id === invoiceId)
        if (inv) {
          setAmount(inv.dueAmount.toFixed(2))
          setAlloc(autoAllocate(paisa(inv.dueAmount), s.openInvoices, inv.id))
          setManual(true)
        }
      }
    },
    [invoiceId],
  )

  const fetchSummary = (c: CustomerOption) => api.get<CustomerDueSummary>(`/api/v1/receipts/customer-summary?customerId=${c.id}`)

  const load = async (c: CustomerOption, prefill: boolean) => {
    setLoading(true)
    setLoadError(null)
    try {
      apply(await fetchSummary(c), prefill)
    } catch (err) {
      setLoadError(errorMessage(err))
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialCustomer) return
    let cancelled = false
    fetchSummary(initialCustomer)
      .then((s) => !cancelled && apply(s, true))
      .catch((err) => !cancelled && setLoadError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [initialCustomer, apply])

  const invoices = useMemo(() => summary?.openInvoices ?? [], [summary])
  const amountP = paisa(amount)
  const effective = useMemo(() => (manual ? alloc : autoAllocate(amountP, invoices)), [manual, alloc, amountP, invoices])

  const allocatedP = invoices.reduce((a, i) => a + paisa(effective[i.id] ?? 0), 0)
  const advanceP = amountP - allocatedP
  const over = invoices.filter((i) => paisa(effective[i.id] ?? 0) > paisa(i.dueAmount))

  const pickCustomer = (c: CustomerOption | null) => {
    setCustomer(c)
    setSummary(null)
    setAlloc({})
    setManual(false)
    setErrors({})
    if (c) load(c, false)
  }

  const submit = async (andPrint: boolean) => {
    const errs: Record<string, string> = {}
    if (!customer) errs.customerId = "Choose a customer"
    if (amountP <= 0) errs.amount = "Enter the amount received"
    if (advanceP < 0) errs.amount = "Allocated more than the amount received"
    if (over.length) errs.allocations = "An allocation is more than the invoice due"
    if (method === "cheque" && !reference.trim()) errs.reference = "Enter the cheque number"
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(andPrint ? "print" : "save")
    try {
      const r = await api.post<{ id: string; number: string; advance: number }>(
        "/api/v1/receipts",
        {
          customerId: customer!.id,
          branchId,
          date: day,
          method,
          reference,
          note,
          amount: taka(amountP),
          allocations: invoices.filter((i) => paisa(effective[i.id] ?? 0) > 0).map((i) => ({ invoiceId: i.id, amount: taka(paisa(effective[i.id])) })),
        },
        { idempotencyKey },
      )
      toast.success(`Receipt ${r.number} saved`, r.advance > 0 ? { description: `${money(r.advance)} kept as advance` } : undefined)
      setIdempotencyKey(crypto.randomUUID())
      router.push(andPrint ? `/print/receipt/${r.id}?auto=1` : `/app/sales/receipts/${r.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields) setErrors(err.details.fields)
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Received from" error={errors.customerId} required className="sm:col-span-2">
              <CustomerPicker value={customer} onChange={pickCustomer} />
            </Field>
            <Field label="Amount received" htmlFor="mr-amount" error={errors.amount} required>
              <Input
                id="mr-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="num h-11 text-lg font-semibold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Date" htmlFor="mr-date" required>
              <Input id="mr-date" type="date" value={day} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setDay(e.target.value)} className="h-11" />
            </Field>
            <Field label="Method" required>
              <Select value={method} onValueChange={setMethod}>
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
            <Field label={REF_LABEL[method] ?? "Reference"} htmlFor="mr-ref" error={errors.reference} hint={method === "cash" ? "Optional" : undefined}>
              <Input id="mr-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
            </Field>
            {app.branches.length > 1 && (
              <Field label="Branch" required>
                <Select value={branchId} onValueChange={setBranchId}>
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
            <Field label="Note" htmlFor="mr-note" className={app.branches.length > 1 ? "" : "sm:col-span-2"}>
              <Textarea id="mr-note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
            </Field>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <div>
              <h2 className="font-semibold">Open invoices</h2>
              <p className="text-xs text-muted-foreground">
                {manual ? "Allocations edited by hand." : "The amount is allocated to the oldest invoices first; edit any row to override."}
              </p>
            </div>
            {manual && (
              <Button variant="ghost" size="sm" onClick={() => setManual(false)}>
                <Sparkles /> Auto-allocate
              </Button>
            )}
          </div>
          {!customer ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Choose a customer to see their open credit invoices.</p>
          ) : loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-between gap-3 px-5 py-6 text-sm">
              <span className="text-destructive">{loadError}</span>
              <Button variant="outline" size="sm" onClick={() => load(customer, false)}>
                Retry
              </Button>
            </div>
          ) : invoices.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No open invoices — the full amount will be kept as an <span className="font-medium text-foreground">advance</span>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs">Invoice</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                    <TableHead className="text-right text-xs">Due</TableHead>
                    <TableHead className="w-[150px] text-right text-xs">Allocate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((i) => {
                    const bad = paisa(effective[i.id] ?? 0) > paisa(i.dueAmount)
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="py-2.5">
                          <p className="num font-medium">{i.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {date(i.date)} · {i.branchName}
                          </p>
                        </TableCell>
                        <TableCell className="num text-right text-muted-foreground">{money(i.total)}</TableCell>
                        <TableCell className="num text-right">{money(i.dueAmount)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            aria-label={`Allocate to ${i.number}`}
                            aria-invalid={bad || undefined}
                            className="num ml-auto h-8 w-[130px] text-right"
                            value={effective[i.id] ?? ""}
                            placeholder="0.00"
                            onChange={(e) => {
                              setAlloc({ ...effective, [i.id]: e.target.value })
                              setManual(true)
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {errors.allocations && <p className="px-5 py-2 text-xs font-medium text-destructive">{errors.allocations}</p>}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Summary</h2>
          {summary && (
            <dl className="mt-3 grid gap-1.5 border-b pb-3 text-sm">
              <Row label="Customer balance" value={money(summary.customer.balance)} tone={summary.customer.balance > 0 ? "danger" : "success"} />
              <Row label="Open invoices due" value={money(summary.totalDue)} />
            </dl>
          )}
          <dl className="mt-3 grid gap-1.5 text-sm">
            <Row label="Received" value={money(taka(amountP))} strong />
            <Row label="Allocated to invoices" value={money(taka(allocatedP))} />
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                Advance {advanceP > 0 && <StatusBadge tone="info">kept on account</StatusBadge>}
              </dt>
              <dd className={`num font-medium ${advanceP < 0 ? "text-destructive" : ""}`}>{money(taka(Math.max(advanceP, 0)))}</dd>
            </div>
          </dl>
          {advanceP < 0 && <p className="mt-2 text-xs font-medium text-destructive">Allocations exceed the amount received.</p>}
          <div className="mt-5 grid gap-2">
            <Button size="lg" onClick={() => submit(false)} disabled={!!busy}>
              {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save receipt
            </Button>
            <Button size="lg" variant="outline" onClick={() => submit(true)} disabled={!!busy}>
              {busy === "print" ? <Loader2 className="animate-spin" /> : <Printer />} Save &amp; print
            </Button>
          </div>
        </section>

        {summary && summary.unappliedAdvance > 0 && (
          <section className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <WalletCards className="size-4 text-info" /> Unapplied advance {money(summary.unappliedAdvance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              From {summary.advances.map((a) => a.number).join(", ")}.{" "}
              {summary.openInvoices.length ? "Apply it to open invoices before taking new money." : "It will settle future credit invoices."}
            </p>
            {summary.openInvoices.length > 0 && customer && (
              <div className="mt-3">
                <ApplyAdvanceButton customerId={customer.id} amount={summary.unappliedAdvance} totalDue={summary.totalDue} onApplied={() => load(customer, false)} />
              </div>
            )}
          </section>
        )}
      </aside>
    </div>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "danger" | "success" }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`num ${strong ? "text-base font-semibold" : "font-medium"} ${tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : ""}`}>{value}</dd>
    </div>
  )
}
