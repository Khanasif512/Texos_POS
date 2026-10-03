"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Banknote, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/shared/data-table"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { Field } from "@/components/shared/field"
import { LcPicker, SupplierPicker, type LcOption, type SupplierOption } from "@/components/shared/pickers"
import { StatusBadge } from "@/components/shared/status-badge"
import { useApp } from "@/components/app/app-context"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { date, dateTime, money } from "@/lib/format"
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, supplierPaymentSchema, type SupplierPaymentInput, type SupplierPaymentOutput } from "@/lib/validation/finance"
import type { PayableRow } from "@/server/modules/finance/payments"
import type { SupplierPaymentRowView } from "@/server/modules/finance/queries"
import { BranchSelect, MethodBadge, MethodSelect, TotalsStrip, todayKey } from "./shared"

export function PayablesClient({
  overview,
  outstanding,
  advances,
  payments,
  paymentsTotal,
  paymentsSum,
  page,
  limit,
  canPay,
  lcEnabled,
}: {
  overview: PayableRow[]
  outstanding: number
  advances: number
  payments: SupplierPaymentRowView[]
  paymentsTotal: number
  paymentsSum: number
  page: number
  limit: number
  canPay: boolean
  lcEnabled: boolean
}) {
  const [paying, setPaying] = useState<SupplierOption | "new" | null>(null)
  const owing = overview.filter((r) => r.outstanding > 0).length

  return (
    <>
      <TotalsStrip
        items={[
          { label: "Total outstanding", value: money(outstanding), hint: `${owing} supplier${owing === 1 ? "" : "s"} owed` },
          { label: "Advances to suppliers", value: money(advances), hint: "Paid ahead of purchases" },
          { label: "Payments (filtered)", value: money(paymentsSum), hint: `${paymentsTotal} payment${paymentsTotal === 1 ? "" : "s"}` },
          { label: "Suppliers", value: String(overview.length), hint: "With activity or active" },
        ]}
      />

      <DataTable
        rows={overview}
        rowKey={(r) => r.id}
        searchPlaceholder="Search suppliers…"
        pageSize={10}
        toolbar={
          canPay && (
            <Button onClick={() => setPaying("new")}>
              <Banknote /> Record payment
            </Button>
          )
        }
        empty="No suppliers yet."
        columns={[
          {
            key: "name",
            header: "Supplier",
            value: (r) => r.name,
            cell: (r) => (
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.code} · {r.country ?? "—"} · {r.currency}
                  {r.openLcs > 0 && ` · ${r.openLcs} open LC${r.openLcs === 1 ? "" : "s"}`}
                </p>
              </div>
            ),
          },
          { key: "purchases", header: "Purchases", align: "right", value: (r) => r.purchases, cell: (r) => <span className="num">{money(r.purchases)}</span> },
          { key: "payments", header: "Paid", align: "right", value: (r) => r.payments, cell: (r) => <span className="num">{money(r.payments)}</span> },
          {
            key: "outstanding",
            header: "Outstanding",
            align: "right",
            value: (r) => r.outstanding,
            cell: (r) =>
              r.outstanding < 0 ? (
                <span className="num text-success" title="Advance paid">
                  {money(-r.outstanding)} adv.
                </span>
              ) : (
                <span className={r.outstanding > 0 ? "num font-semibold" : "num text-muted-foreground"}>{money(r.outstanding)}</span>
              ),
          },
          {
            key: "last",
            header: "Last payment",
            value: (r) => r.lastPaymentAt ?? "",
            cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{r.lastPaymentAt ? date(r.lastPaymentAt) : "—"}</span>,
          },
          {
            key: "pay",
            header: "",
            align: "right",
            cell: (r) =>
              canPay && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaying({ id: r.id, code: r.code, name: r.name, country: r.country, currency: r.currency })}
                >
                  Pay
                </Button>
              ),
          },
        ]}
      />

      <div>
        <h2 className="mb-3 font-semibold">Payments</h2>
        <ServerTable
          rows={payments}
          total={paymentsTotal}
          page={page}
          limit={limit}
          rowKey={(r) => r.id}
          searchPlaceholder="Search number, supplier, reference…"
          filters={
            <>
              <BranchFilter />
              <SelectFilter name="method" placeholder="All methods" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
              <DateRangeFilter />
            </>
          }
          empty="No supplier payments recorded."
          columns={[
            { key: "number", header: "Number", sortKey: "number", cell: (r) => <span className="num text-xs font-medium">{r.number}</span> },
            { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{dateTime(r.date)}</span> },
            { key: "supplier", header: "Supplier", cell: (r) => <span className="font-medium">{r.supplierName}</span> },
            { key: "branch", header: "Branch", cell: (r) => <span className="text-muted-foreground">{r.branchName}</span> },
            { key: "method", header: "Method", cell: (r) => <MethodBadge method={r.method} /> },
            {
              key: "ref",
              header: "Reference",
              cell: (r) => (
                <div className="max-w-[240px] text-xs">
                  <p className="truncate">{r.reference ?? "—"}</p>
                  {r.lcNumber && <StatusBadge tone="info">LC {r.lcNumber}</StatusBadge>}
                </div>
              ),
            },
            { key: "amount", header: "Amount", sortKey: "amount", align: "right", cell: (r) => <span className="num font-medium">{money(r.amount)}</span> },
          ]}
        />
      </div>

      {paying && (
        <PaymentDialog
          supplier={paying === "new" ? null : paying}
          outstanding={paying === "new" ? undefined : overview.find((o) => o.id === paying.id)?.outstanding}
          lcEnabled={lcEnabled}
          onClose={() => setPaying(null)}
        />
      )}
    </>
  )
}

function PaymentDialog({
  supplier: initial,
  outstanding,
  lcEnabled,
  onClose,
}: {
  supplier: SupplierOption | null
  outstanding?: number
  lcEnabled: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const app = useApp()
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])
  const [supplier, setSupplier] = useState<SupplierOption | null>(initial)
  const [lc, setLc] = useState<LcOption | null>(null)
  const { register, handleSubmit, formState, setError, control, setValue, watch } = useForm<SupplierPaymentInput, unknown, SupplierPaymentOutput>({
    resolver: zodResolver(supplierPaymentSchema),
    defaultValues: {
      supplierId: initial?.id ?? "",
      branchId: app.activeBranchId,
      method: "bank",
      date: todayKey(),
      reference: "",
      note: "",
      lcId: null,
    },
  })
  const e = formState.errors
  const amount = Number(watch("amount") ?? 0)

  const onSubmit = handleSubmit(async (v) => {
    try {
      const res = await api.post<{ number: string; balance: number }>("/api/v1/supplier-payments", v, { idempotencyKey })
      toast.success(`Payment ${res.number} recorded`, { description: `${supplier?.name ?? "Supplier"} balance is now ${money(res.balance)}.` })
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-4" /> Record supplier payment
          </DialogTitle>
          <DialogDescription>Reduces the supplier&apos;s payable balance. Cash payments count as payouts in the branch&apos;s cash closing.</DialogDescription>
        </DialogHeader>
        <form id="payment-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Supplier" error={e.supplierId?.message} required className="sm:col-span-2">
            <SupplierPicker
              value={supplier}
              onChange={(s) => {
                setSupplier(s)
                setValue("supplierId", s?.id ?? "", { shouldValidate: formState.isSubmitted })
                setLc(null)
                setValue("lcId", null)
              }}
            />
          </Field>
          {outstanding != null && supplier?.id === initial?.id && (
            <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
              Outstanding: <span className="num font-medium text-foreground">{money(outstanding)}</span>
              {amount > 0 && outstanding > 0 && amount > outstanding && <span className="text-warning"> — this payment exceeds it (advance).</span>}
            </p>
          )}
          <Field label="Amount (৳)" htmlFor="amount" error={e.amount?.message} required>
            <Input id="amount" type="number" inputMode="decimal" step="0.01" min="0" className="num" autoFocus={!!initial} {...register("amount")} />
          </Field>
          <Field label="Date" htmlFor="date" error={e.date?.message} required>
            <Input id="date" type="date" max={todayKey()} {...register("date")} />
          </Field>
          <Field label="Method" error={e.method?.message} required>
            <Controller control={control} name="method" render={({ field }) => <MethodSelect value={field.value ?? "bank"} onChange={field.onChange} />} />
          </Field>
          <Field label="Paid from branch" error={e.branchId?.message} required>
            <Controller control={control} name="branchId" render={({ field }) => <BranchSelect value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Reference" htmlFor="reference" error={e.reference?.message} hint="TT / cheque / transaction no." className="sm:col-span-2">
            <Input id="reference" {...register("reference")} />
          </Field>
          {lcEnabled && (
            <Field label="Against LC (optional)" error={e.lcId?.message} className="sm:col-span-2">
              <div className="flex gap-2">
                <LcPicker
                  value={lc}
                  onChange={(v) => {
                    setLc(v)
                    setValue("lcId", v?.id ?? null)
                  }}
                />
                {lc && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9"
                    aria-label="Remove LC"
                    onClick={() => {
                      setLc(null)
                      setValue("lcId", null)
                    }}
                  >
                    <X />
                  </Button>
                )}
              </div>
            </Field>
          )}
          <Field label="Note" htmlFor="note" error={e.note?.message} className="sm:col-span-2">
            <Input id="note" {...register("note")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
