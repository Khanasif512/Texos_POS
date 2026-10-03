"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FilePlus2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field } from "@/components/shared/field"
import { DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { ServerTable } from "@/components/shared/server-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { date, money } from "@/lib/format"
import { BILLING_STATUS_LABELS, billingStatusTone, manualInvoiceSchema, type ManualInvoiceInput, type ManualInvoiceOutput } from "@/lib/validation/billing"
import { InvoiceActions } from "./invoice-actions"

type Row = {
  id: string
  number: string
  description: string | null
  amount: number
  status: string
  issuedAt: string
  dueAt: string | null
  paidAt: string | null
  paymentReference: string | null
  company: { id: string; name: string }
}
type Option = { id: string; name: string }
type PlanOption = Option & { priceMonthly: number; priceYearly: number }

export function BillingInvoicesTable({
  rows,
  total,
  page,
  limit,
  companies,
  plans,
}: {
  rows: Row[]
  total: number
  page: number
  limit: number
  companies: Option[]
  plans: PlanOption[]
}) {
  const [creating, setCreating] = useState(false)
  const overdue = (r: Row) => r.status === "unpaid" && r.dueAt && new Date(r.dueAt) < new Date()
  return (
    <>
      <ServerTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        rowKey={(r) => r.id}
        searchPlaceholder="Invoice no., reference, company…"
        filters={
          <>
            <SelectFilter name="status" placeholder="All statuses" options={Object.entries(BILLING_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
            <SelectFilter name="companyId" placeholder="All companies" options={companies.map((c) => ({ value: c.id, label: c.name }))} />
            <DateRangeFilter />
          </>
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <FilePlus2 /> New invoice
          </Button>
        }
        empty="No billing invoices match these filters."
        columns={[
          {
            key: "number",
            header: "Invoice",
            sortKey: "number",
            cell: (r) => (
              <div>
                <p className="num font-medium">{r.number}</p>
                <p className="max-w-56 truncate text-xs text-muted-foreground">{r.description}</p>
              </div>
            ),
          },
          {
            key: "company",
            header: "Company",
            cell: (r) => (
              <Link href={`/admin/tenants/${r.company.id}`} className="font-medium hover:underline">
                {r.company.name}
              </Link>
            ),
          },
          { key: "issued", header: "Issued", sortKey: "issuedAt", cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{date(r.issuedAt)}</span> },
          {
            key: "due",
            header: "Due / paid",
            sortKey: "dueAt",
            cell: (r) =>
              r.status === "paid" ? (
                <span className="whitespace-nowrap text-muted-foreground">Paid {date(r.paidAt)}</span>
              ) : (
                <span className={overdue(r) ? "font-medium whitespace-nowrap text-destructive" : "whitespace-nowrap text-muted-foreground"}>{date(r.dueAt)}</span>
              ),
          },
          { key: "amount", header: "Amount", align: "right", sortKey: "amount", cell: (r) => <span className="num font-medium">{money(r.amount)}</span> },
          {
            key: "status",
            header: "Status",
            cell: (r) => (
              <div className="space-y-0.5">
                <StatusBadge tone={billingStatusTone(r.status)}>{BILLING_STATUS_LABELS[r.status as keyof typeof BILLING_STATUS_LABELS] ?? r.status}</StatusBadge>
                {r.paymentReference && <p className="max-w-36 truncate font-mono text-[11px] text-muted-foreground" title={r.paymentReference}>Ref {r.paymentReference}</p>}
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (r) => <InvoiceActions invoice={{ id: r.id, number: r.number, amount: r.amount, status: r.status, companyName: r.company.name, paymentReference: r.paymentReference }} compact />,
          },
        ]}
      />
      {creating && <ManualInvoiceDialog companies={companies} plans={plans} onClose={() => setCreating(false)} />}
    </>
  )
}

export function ManualInvoiceDialog({
  companies,
  plans,
  companyId,
  onClose,
}: {
  companies: Option[]
  plans: PlanOption[]
  companyId?: string
  onClose: () => void
}) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, setValue, watch } = useForm<ManualInvoiceInput, unknown, ManualInvoiceOutput>({
    resolver: zodResolver(manualInvoiceSchema),
    defaultValues: { companyId: companyId ?? "", planId: "", cycle: "monthly", dueDays: 7, description: "" },
  })
  const e = formState.errors
  const planId = watch("planId") ?? ""
  const cycle = watch("cycle") ?? "monthly"
  const applyPlan = (id: string, c: string) => {
    const p = plans.find((x) => x.id === id)
    if (!p) return
    setValue("amount", c === "yearly" ? p.priceYearly : p.priceMonthly)
    setValue("description", `${p.name} plan · ${c === "yearly" ? "Yearly" : "Monthly"}`)
  }
  const onSubmit = handleSubmit(async (v) => {
    try {
      const r = await api.post<{ number: string }>("/api/v1/admin/billing", v)
      toast.success(`Invoice ${r.number} issued and emailed`)
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New billing invoice</DialogTitle>
          <DialogDescription>Choose a plan to activate it when paid, or leave it empty for a one-off charge (setup, training…).</DialogDescription>
        </DialogHeader>
        <form id="manual-invoice" onSubmit={onSubmit} className="grid gap-4" noValidate>
          {!companyId && (
            <Field label="Company" error={e.companyId?.message} required>
              <Select value={watch("companyId")} onValueChange={(v) => setValue("companyId", v, { shouldValidate: true })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Plan" hint="Activated on payment">
              <Select
                value={planId || "none"}
                onValueChange={(v) => {
                  setValue("planId", v === "none" ? "" : v)
                  applyPlan(v, cycle)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No plan (one-off charge)</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cycle">
              <Select
                value={cycle}
                disabled={!planId}
                onValueChange={(v) => {
                  setValue("cycle", v as "monthly")
                  applyPlan(planId, v)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="description" error={e.description?.message} required>
            <Input id="description" {...register("description")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (BDT)" htmlFor="amount" error={e.amount?.message} required>
              <Input id="amount" type="number" step="0.01" min={0} className="num" {...register("amount")} />
            </Field>
            <Field label="Due in (days)" htmlFor="dueDays" error={e.dueDays?.message}>
              <Input id="dueDays" type="number" min={0} max={90} {...register("dueDays")} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="manual-invoice" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />} Issue invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
