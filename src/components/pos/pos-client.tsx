"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Banknote, CreditCard, FileText, Landmark, Loader2, NotebookPen, ShieldAlert, Smartphone, Trash2, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CustomerPicker, type CustomerOption, type VariationOption } from "@/components/shared/pickers"
import { useApp, useCan } from "@/components/app/app-context"
import { api, ApiError, errorMessage } from "@/lib/api-client"
import { money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Cart } from "./cart"
import { CustomerQuickAdd } from "./customer-quick-add"
import { ProductSearch, type ProductSearchHandle } from "./product-search"
import { cartTotals, lineAmounts, r2, toNum, type CartLine, type OrderPreload, type Salesman } from "./pos-types"
import { SaleSuccessDialog, type SaleResult } from "./sale-success-dialog"

type Method = "cash" | "bank" | "mobile_banking" | "card"
type CreditDetails = { balance: number; creditLimit: number; due: number; available: number; excess: number; canOverride: boolean }

const METHODS: { value: Method; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "mobile_banking", label: "bKash/Nagad", icon: Smartphone },
  { value: "bank", label: "Bank", icon: Landmark },
]

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
}

export function PosClient({ salesmen, order, orderError }: { salesmen: Salesman[]; order: OrderPreload | null; orderError: string | null }) {
  const app = useApp()
  const router = useRouter()
  const canDiscount = useCan("sales.discount")
  const canOverride = useCan("sales.override_credit")
  const canAddCustomer = useCan("customers.create")

  const [branchId, setBranchId] = useState(order?.branchId ?? app.activeBranchId)
  const [lines, setLines] = useState<CartLine[]>(order?.lines ?? [])
  const [type, setType] = useState<"cash" | "credit">(order?.customer ? "credit" : "cash")
  const [customer, setCustomer] = useState<CustomerOption | null>(order?.customer ?? null)
  const [walkIn, setWalkIn] = useState({ name: "", phone: "" })
  const [salesmanId, setSalesmanId] = useState(order?.salesmanId && salesmen.some((s) => s.id === order.salesmanId) ? order.salesmanId : app.userId)
  const [adj, setAdj] = useState({ discount: order?.discount ? String(order.discount) : "", tax: "", delivery: "" })
  const [method, setMethod] = useState<Method>("cash")
  const [received, setReceived] = useState("")
  const [reference, setReference] = useState("")
  const [showMore, setShowMore] = useState(!!order?.note)
  const [note, setNote] = useState(order?.note ?? "")
  const [address, setAddress] = useState("")
  const [override, setOverride] = useState(false)
  const [creditError, setCreditError] = useState<CreditDetails | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SaleResult | null>(null)
  const [quickAdd, setQuickAdd] = useState(false)
  const [salesOrderId, setSalesOrderId] = useState(order?.id ?? null)

  const idemKey = useRef(newKey())
  const searchRef = useRef<ProductSearchHandle>(null)
  const receivedRef = useRef<HTMLInputElement>(null)
  const customerWrap = useRef<HTMLDivElement>(null)

  const totals = useMemo(() => cartTotals(lines, adj), [lines, adj])
  const inCart = useMemo(() => new Map(lines.map((l) => [l.variationId, toNum(l.qty)])), [lines])
  const branch = app.branches.find((b) => b.id === branchId)

  // payment
  const receivedNum = r2(toNum(received))
  const paidNow = type === "cash" ? totals.total : Math.min(receivedNum, totals.total)
  const due = type === "cash" ? 0 : r2(totals.total - paidNow)
  const change = type === "cash" && method === "cash" && received ? r2(receivedNum - totals.total) : 0

  // credit limit (CRM-01) — preview only, the server decides
  const available = customer ? Math.max(0, r2(customer.creditLimit - customer.balance)) : 0
  const overLimit = type === "credit" && !!customer && due > 0 && r2(customer.balance + due) > customer.creditLimit
  const excess = customer ? r2(customer.balance + due - customer.creditLimit) : 0

  const problems = useMemo(() => {
    const p: string[] = []
    if (!lines.length) p.push("Add at least one product")
    for (const l of lines) {
      const a = lineAmounts(l)
      if (a.qty <= 0) p.push(`Enter a quantity for ${l.productName}`)
      else if (a.qty > l.stock) p.push(`Not enough stock for ${l.productName}`)
      if (a.discount > a.gross) p.push(`Discount too high on ${l.productName}`)
    }
    if (totals.discount > totals.subtotal) p.push("Discount is more than the subtotal")
    if (type === "credit" && !customer) p.push("Choose a customer for a credit sale")
    if (type === "cash" && method === "cash" && received && receivedNum < totals.total)
      p.push("Cash received is less than the total — switch to Credit for part payment")
    if (type === "credit" && receivedNum > totals.total) p.push("Paid amount is more than the total")
    if (overLimit && !(canOverride && override)) p.push("Customer is over the credit limit")
    return p
  }, [lines, totals, type, customer, method, received, receivedNum, overLimit, canOverride, override])

  // ───────── cart actions ─────────

  const addProduct = useCallback(
    (v: VariationOption) => {
      const existing = lines.find((l) => l.variationId === v.id)
      if (existing) {
        const next = toNum(existing.qty) + 1
        if (next > v.stock) return toast.error(`Only ${quantity(v.stock)} ${v.unit} of ${v.productName} in stock`)
        setLines((prev) => prev.map((l) => (l.variationId === v.id ? { ...l, qty: String(next), stock: v.stock } : l)))
      } else {
        if (v.stock <= 0) return toast.error(`${v.productName} — ${v.name} is out of stock at ${branch?.name ?? "this branch"}`)
        const wholesale = customer && customer.type !== "retail" && v.wholesalePrice ? v.wholesalePrice : null
        const price = wholesale ?? v.salePrice
        setLines((prev) => [
          ...prev,
          {
            variationId: v.id,
            productName: v.productName,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            unit: v.unit,
            stock: v.stock,
            listPrice: price,
            qty: "1",
            price: String(price),
            discount: "",
          },
        ])
      }
      setFocusId(v.id)
      setErrorId(null)
    },
    [lines, customer, branch],
  )

  const changeLine = (id: string, patch: Partial<CartLine>) => {
    setLines((prev) => prev.map((l) => (l.variationId === id ? { ...l, ...patch } : l)))
    if (errorId === id) setErrorId(null)
  }
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.variationId !== id))

  const resetSale = useCallback(() => {
    setLines([])
    setType("cash")
    setCustomer(null)
    setWalkIn({ name: "", phone: "" })
    setSalesmanId(app.userId)
    setAdj({ discount: "", tax: "", delivery: "" })
    setMethod("cash")
    setReceived("")
    setReference("")
    setNote("")
    setAddress("")
    setShowMore(false)
    setOverride(false)
    setCreditError(null)
    setErrorId(null)
    setFocusId(null)
    setSalesOrderId(null)
    idemKey.current = newKey()
  }, [app.userId])

  const newSale = useCallback(() => {
    const fromOrder = !!result && !!order
    setResult(null)
    resetSale()
    searchRef.current?.refresh()
    if (fromOrder) router.replace("/app/pos")
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [result, order, resetSale, router])

  // ───────── submit ─────────

  const complete = useCallback(async () => {
    if (submitting || result) return
    if (problems.length) {
      toast.error(problems[0])
      return
    }
    setSubmitting(true)
    setCreditError(null)
    try {
      const res = await api.post<Omit<SaleResult, "change">>(
        "/api/v1/invoices",
        {
          branchId,
          type,
          customerId: customer?.id ?? null,
          customerName: customer ? null : walkIn.name || null,
          customerPhone: customer ? null : walkIn.phone || null,
          salesmanId,
          salesOrderId,
          lines: lines.map((l) => ({ variationId: l.variationId, quantity: toNum(l.qty), unitPrice: toNum(l.price), discount: toNum(l.discount) })),
          discount: totals.discount,
          tax: totals.tax,
          deliveryCharge: totals.delivery,
          paymentMethod: method,
          paidAmount: type === "credit" ? paidNow : 0,
          paymentReference: reference || null,
          overrideCreditLimit: canOverride && override,
          deliveryAddress: address || null,
          note: note || null,
        },
        { idempotencyKey: idemKey.current },
      )
      setResult({ ...res, change: Math.max(0, change) })
    } catch (err) {
      if (err instanceof ApiError) {
        const d = err.details as (Partial<CreditDetails> & { reason?: string; variationId?: string }) | undefined
        if (d?.reason === "CREDIT_LIMIT") {
          setCreditError(d as CreditDetails)
          if (customer) setCustomer({ ...customer, balance: d.balance ?? customer.balance, creditLimit: d.creditLimit ?? customer.creditLimit })
        }
        if (d?.variationId) {
          setErrorId(d.variationId)
          setFocusId(d.variationId)
        }
      }
      toast.error(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, result, problems, branchId, type, customer, walkIn, salesmanId, salesOrderId, lines, totals, method, paidNow, reference, canOverride, override, address, note, change])

  // ───────── keyboard (NFR-UX-02) ─────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result || e.defaultPrevented) return
      if (document.querySelector("[role=dialog][data-state=open],[data-slot=popover-content][data-state=open],[data-slot=select-content][data-state=open]")) return
      if (e.key === "F9" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        void complete()
      } else if (e.key === "F2") {
        e.preventDefault()
        setType((t) => (t === "cash" ? "credit" : "cash"))
      } else if (e.key === "F3") {
        e.preventDefault()
        customerWrap.current?.querySelector<HTMLButtonElement>("button[role=combobox]")?.click()
      } else if (e.key === "F4") {
        e.preventDefault()
        receivedRef.current?.focus()
        receivedRef.current?.select()
      } else if (e.key === "F1" || (e.key === "/" && !isTyping(e.target))) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === "Escape" && isTyping(e.target)) {
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [complete, result])

  const switchType = (t: "cash" | "credit") => {
    setType(t)
    setReceived("")
    setCreditError(null)
  }

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 lg:h-[calc(100svh-3.5rem)] lg:flex-row lg:overflow-hidden">
      {/* ───────── left: products ───────── */}
      <section className="flex min-h-[60svh] min-w-0 flex-1 flex-col lg:min-h-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold tracking-tight">Point of sale</h1>
            <p className="text-xs text-muted-foreground">Prices and stock shown for the selected branch.</p>
          </div>
          {app.branches.length > 1 && (
            <Select
              value={branchId}
              onValueChange={(v) => {
                setBranchId(v)
                setErrorId(null)
              }}
              disabled={lines.length > 0}
            >
              <SelectTrigger className="h-9 w-[200px]" title={lines.length ? "Clear the cart to switch branch" : undefined}>
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
          )}
        </div>

        {orderError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" /> {orderError}
          </div>
        )}
        {salesOrderId && order && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-primary" />
            <span className="flex-1">
              Converting {order.type === "order" ? "sales order" : "quotation"} <span className="num font-medium">{order.number}</span> into an invoice.
            </span>
            <Button variant="ghost" size="xs" onClick={() => router.replace("/app/pos")}>
              <X /> Discard
            </Button>
          </div>
        )}

        <ProductSearch ref={searchRef} branchId={branchId} onAdd={addProduct} inCart={inCart} />

        <p className="mt-2 hidden flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground lg:flex">
          {[
            ["F1", "Search"],
            ["F2", "Cash / Credit"],
            ["F3", "Customer"],
            ["F4", "Payment"],
            ["F9", "Complete sale"],
            ["Esc", "Clear / back to search"],
          ].map(([k, l]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1 py-px font-sans text-[10px] font-medium text-foreground/70">{k}</kbd> {l}
            </span>
          ))}
        </p>
      </section>

      {/* ───────── right: cart + checkout ───────── */}
      <aside className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm lg:h-full lg:w-[420px] xl:w-[460px]">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">Current sale</h2>
          <span className="num rounded-full bg-muted px-2 py-px text-[11px] text-muted-foreground">
            {lines.length} {lines.length === 1 ? "line" : "lines"} · {quantity(totals.items)} qty
          </span>
          {lines.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (window.confirm("Clear all items from this sale?")) setLines([])
              }}
            >
              <Trash2 /> Clear
            </Button>
          )}
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto lg:min-h-0">
          <Cart lines={lines} canEditPrice={canDiscount} focusId={focusId} errorId={errorId} onChange={changeLine} onRemove={removeLine} />
        </div>

        <div className="max-h-[62%] shrink-0 space-y-3 overflow-y-auto border-t bg-muted/20 px-4 py-3">
          {/* type + salesman */}
          <div className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 rounded-lg border bg-background p-0.5" role="radiogroup" aria-label="Invoice type">
              {(["cash", "credit"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => switchType(t)}
                  className={cn(
                    "h-8 rounded-md text-sm font-medium capitalize transition-colors",
                    type === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <Select value={salesmanId} onValueChange={setSalesmanId}>
              <SelectTrigger className="h-9 w-[46%] bg-background" aria-label="Salesman">
                <SelectValue placeholder="Salesman" />
              </SelectTrigger>
              <SelectContent>
                {salesmen.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.id === app.userId && " (me)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* customer */}
          <div className="space-y-2">
            <div className="flex gap-2" ref={customerWrap}>
              <div className="min-w-0 flex-1">
                <CustomerPicker
                  value={customer}
                  onChange={(c) => {
                    setCustomer(c)
                    setCreditError(null)
                    setOverride(false)
                  }}
                  placeholder={type === "credit" ? "Customer (required for credit)…" : "Walk-in customer — search to attach…"}
                  className="bg-background"
                />
              </div>
              {customer ? (
                <Button variant="outline" size="icon-lg" onClick={() => setCustomer(null)} aria-label="Remove customer">
                  <X />
                </Button>
              ) : (
                canAddCustomer && (
                  <Button variant="outline" size="icon-lg" onClick={() => setQuickAdd(true)} aria-label="Add new customer" title="Add new customer">
                    <UserPlus />
                  </Button>
                )
              )}
            </div>
            {customer ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Balance", customer.balance, customer.balance > 0 ? "text-destructive" : customer.balance < 0 ? "text-success" : ""],
                  ["Credit limit", customer.creditLimit, ""],
                  ["Available", available, available <= 0 ? "text-destructive" : "text-success"],
                ].map(([label, v, tone]) => (
                  <div key={label as string} className="rounded-lg border bg-background px-2 py-1.5">
                    <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label as string}</p>
                    <p className={cn("num truncate text-xs font-semibold", tone as string)}>
                      {label === "Balance" && (v as number) < 0 ? `${money(Math.abs(v as number))} adv` : money(v as number)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              type === "cash" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={walkIn.name}
                    onChange={(e) => setWalkIn((w) => ({ ...w, name: e.target.value }))}
                    placeholder="Walk-in name (optional)"
                    className="h-8 bg-background text-sm"
                    maxLength={160}
                  />
                  <Input
                    value={walkIn.phone}
                    onChange={(e) => setWalkIn((w) => ({ ...w, phone: e.target.value }))}
                    placeholder="Phone (optional)"
                    inputMode="tel"
                    className="h-8 bg-background text-sm"
                    maxLength={40}
                  />
                </div>
              )
            )}
            {(overLimit || creditError) && customer && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-destructive">
                  <ShieldAlert className="size-3.5" />
                  {customer.creditLimit <= 0
                    ? "This customer has no credit limit."
                    : `Over credit limit by ${money(Math.max(excess, creditError?.excess ?? 0))}.`}
                </p>
                <p className="mt-0.5 text-muted-foreground">Take more payment now, or ask a manager to override.</p>
                {canOverride && (
                  <label className="mt-2 flex items-center gap-2 font-medium">
                    <Checkbox checked={override} onCheckedChange={(c) => setOverride(!!c)} />
                    Override credit limit (logged in audit trail)
                  </label>
                )}
              </div>
            )}
          </div>

          {/* adjustments */}
          <div className="grid grid-cols-3 gap-2">
            {canDiscount && (
              <AmountInput label="Discount" value={adj.discount} onChange={(v) => setAdj((a) => ({ ...a, discount: v }))} />
            )}
            <AmountInput label="Delivery" value={adj.delivery} onChange={(v) => setAdj((a) => ({ ...a, delivery: v }))} />
            <AmountInput label="VAT / tax" value={adj.tax} onChange={(v) => setAdj((a) => ({ ...a, tax: v }))} />
          </div>

          {/* payment */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  aria-pressed={method === m.value}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border bg-background text-[11px] font-medium transition-colors",
                    method === m.value ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <m.icon className="size-4" />
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(type === "credit" || method === "cash") && (
                <div className="grid gap-1">
                  <label htmlFor="pos-received" className="text-[11px] font-medium text-muted-foreground">
                    {type === "cash" ? "Cash received" : "Paid now"} <kbd className="text-[10px] opacity-70">F4</kbd>
                  </label>
                  <Input
                    id="pos-received"
                    ref={receivedRef}
                    value={received}
                    onChange={(e) => setReceived(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder={type === "cash" ? totals.total.toFixed(2) : "0.00"}
                    className="num h-9 bg-background text-right"
                  />
                </div>
              )}
              {method !== "cash" && (type === "cash" || receivedNum > 0) && (
                <div className="grid gap-1">
                  <label htmlFor="pos-ref" className="text-[11px] font-medium text-muted-foreground">
                    Reference / Txn ID
                  </label>
                  <Input id="pos-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 bg-background" maxLength={120} />
                </div>
              )}
            </div>
          </div>

          {/* notes */}
          {showMore ? (
            <div className="grid gap-2">
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder={customer?.address ? `Delivery address (default: ${customer.address})` : "Delivery address for the challan"} className="min-h-0 bg-background text-sm" maxLength={500} />
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Invoice note" className="min-h-0 bg-background text-sm" maxLength={1000} />
            </div>
          ) : (
            <button type="button" onClick={() => setShowMore(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <NotebookPen className="size-3.5" /> Add note or delivery address
            </button>
          )}
        </div>

        {/* totals + complete */}
        <div className="shrink-0 border-t px-4 pt-3 pb-4">
          <dl className="space-y-1 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {totals.lineDiscount + totals.discount > 0 && <Row label="Discount" value={`− ${money(totals.lineDiscount + totals.discount)}`} hint={totals.lineDiscount > 0 ? "incl. line discounts" : undefined} />}
            {totals.delivery > 0 && <Row label="Delivery charge" value={money(totals.delivery)} />}
            {totals.tax > 0 && <Row label="VAT / tax" value={money(totals.tax)} />}
          </dl>
          <div className="mt-2 flex items-end justify-between border-t border-dashed pt-2">
            <span className="text-sm font-medium">Total</span>
            <span className="num text-2xl font-bold tracking-tight">{money(totals.total)}</span>
          </div>
          {type === "cash" && change > 0 && (
            <div className="mt-1 flex justify-between text-sm font-medium text-success">
              <span>Change</span>
              <span className="num">{money(change)}</span>
            </div>
          )}
          {type === "credit" && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Paid {money(paidNow)} · Due</span>
              <span className={cn("num font-semibold", due > 0 && "text-destructive")}>{money(due)}</span>
            </div>
          )}
          <Button
            className="mt-3 h-12 w-full rounded-xl text-base font-semibold shadow-sm"
            disabled={submitting || !lines.length}
            onClick={() => void complete()}
          >
            {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
            {submitting ? "Saving…" : `Complete ${type} sale`}
            {!submitting && <kbd className="ml-2 rounded bg-primary-foreground/15 px-1.5 py-px text-[11px] font-medium">F9</kbd>}
          </Button>
          {problems.length > 0 && lines.length > 0 && <p className="mt-2 text-center text-xs text-destructive">{problems[0]}</p>}
          {!app.permissions.includes("*") && !canDiscount && lines.length > 0 && (
            <p className="mt-1 text-center text-[11px] text-muted-foreground">Price changes and discounts need manager permission.</p>
          )}
        </div>
      </aside>

      <CustomerQuickAdd
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        initialName={walkIn.name}
        onCreated={(c) => {
          setCustomer(c)
          if (!walkIn.phone) setWalkIn({ name: "", phone: "" })
        }}
      />
      <SaleSuccessDialog result={result} onNewSale={newSale} />
    </div>
  )
}

function AmountInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        onFocus={(e) => e.target.select()}
        inputMode="decimal"
        placeholder="0.00"
        className="num h-8 bg-background text-right text-sm"
      />
    </label>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-[11px]">({hint})</span>}
      </dt>
      <dd className="num">{value}</dd>
    </div>
  )
}
