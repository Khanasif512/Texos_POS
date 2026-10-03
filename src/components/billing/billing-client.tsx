"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { addDays, differenceInCalendarDays } from "date-fns"
import { AlertTriangle, CalendarClock, Check, CreditCard, Loader2, Minus, Printer, Receipt, RotateCcw, XCircle } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errorMessage } from "@/lib/api-client"
import { date, integer, money } from "@/lib/format"
import { FEATURE_LABELS, type PlanFeatures } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { BILLING_STATUS_LABELS, billingStatusTone, SUB_STATUS_TONE } from "@/lib/validation/billing"
import type { BillingSummary } from "@/server/modules/platform/billing"
import { PaymentDialog, type PaymentTarget } from "./payment-dialog"

type Cycle = "monthly" | "yearly"
type CurrentPlan = { name: string; maxBranches: number; maxEmployees: number; maxProducts: number | null; features: PlanFeatures }
type PlanCard = BillingSummary["plans"][number]
type Sub = NonNullable<BillingSummary["subscription"]>

const SUB_LABEL: Record<string, string> = { trialing: "Free trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled", expired: "Expired" }

export function BillingClient({ summary, plan, readOnlyReason }: { summary: BillingSummary; plan: CurrentPlan; readOnlyReason: string | null }) {
  const [pay, setPay] = useState<PaymentTarget | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const openInvoice = async (id: string) => {
    setOpening(id)
    try {
      setPay(await api.get<PaymentTarget>(`/api/v1/billing/invoices/${id}`))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setOpening(null)
    }
  }
  const unpaid = summary.invoices.filter((i) => i.status === "unpaid")

  return (
    <>
      {unpaid.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              Invoice {unpaid[0].number} · {money(unpaid[0].amount)} is awaiting payment
              {unpaid[0].dueAt ? ` (due ${date(unpaid[0].dueAt)})` : ""}.
            </p>
            <p className="text-muted-foreground">
              {unpaid[0].paymentReference
                ? `Reference ${unpaid[0].paymentReference} received — we are confirming it.`
                : "Pay by bank transfer or bKash, then send us the transaction reference."}
            </p>
          </div>
          <Button onClick={() => openInvoice(unpaid[0].id)} disabled={opening === unpaid[0].id}>
            {opening === unpaid[0].id ? <Loader2 className="animate-spin" /> : <CreditCard />} {unpaid[0].paymentReference ? "View payment" : "Pay now"}
          </Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SubscriptionCard sub={summary.subscription} plan={plan} readOnlyReason={readOnlyReason} />
        <UsageCard usage={summary.usage} plan={plan} />
      </div>
      <PlanPicker summary={summary} onInvoice={setPay} />
      <InvoiceHistory invoices={summary.invoices} onPay={openInvoice} opening={opening} />
      {pay && <PaymentDialog target={pay} onClose={() => setPay(null)} />}
    </>
  )
}

// ───────────────────────────── Current subscription ─────────────────────────────

function SubscriptionCard({ sub, plan, readOnlyReason }: { sub: Sub | null; plan: CurrentPlan; readOnlyReason: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const now = new Date()

  const act = async (key: string, body: object) => {
    setBusy(key)
    try {
      const r = await api.post<{ message: string }>("/api/v1/billing/subscription", body)
      toast.success(r.message)
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (!sub)
    return (
      <section className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">No subscription found. Choose a plan below to get started.</p>
      </section>
    )

  const trialEnds = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null
  const trialStart = sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null
  const trialDaysLeft = trialEnds ? Math.max(0, differenceInCalendarDays(trialEnds, now)) : 0
  const trialTotal = trialEnds && trialStart ? Math.max(1, differenceInCalendarDays(trialEnds, trialStart)) : 14
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null
  const pendingCancel = sub.status === "active" && !!sub.cancelledAt
  const keepsPeriod = sub.status === "active" && periodEnd && periodEnd > now
  const retentionPreview = addDays(keepsPeriod && periodEnd ? periodEnd : now, 90)
  const canResume = pendingCancel || (sub.status === "cancelled" && !!trialEnds && trialEnds > now)
  const canCancel = !sub.cancelledAt && sub.status !== "cancelled"

  return (
    <section className="flex flex-col rounded-xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{sub.planName}</h2>
          {sub.status !== "trialing" && <p className="text-sm text-muted-foreground capitalize">{sub.billingCycle} billing</p>}
        </div>
        <StatusBadge tone={SUB_STATUS_TONE[sub.status as keyof typeof SUB_STATUS_TONE] ?? "neutral"}>{SUB_LABEL[sub.status] ?? sub.status}</StatusBadge>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        {sub.status === "trialing" && trialEnds && (
          <div>
            <div className="flex justify-between">
              <span>{trialEnds > now ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial` : "Your free trial has ended"}</span>
              <span className="text-muted-foreground">ends {date(trialEnds)}</span>
            </div>
            <Progress value={Math.min(100, ((trialTotal - trialDaysLeft) / trialTotal) * 100)} className="mt-2 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">Choose a plan before the trial ends to keep full access. Your data stays safe either way.</p>
          </div>
        )}
        {sub.status === "active" && periodEnd && (
          <p className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            {pendingCancel
              ? `Cancels on ${date(periodEnd)} — full access until then.`
              : sub.autoRenew
                ? `Renews on ${date(periodEnd)}. We'll email the renewal invoice.`
                : `Ends on ${date(periodEnd)} — auto-renew is off.`}
          </p>
        )}
        {sub.status === "past_due" && (
          <p className="flex items-center gap-2 text-warning">
            <AlertTriangle className="size-4" />
            {sub.graceEndsAt && new Date(sub.graceEndsAt) > now
              ? `Renewal payment due by ${date(sub.graceEndsAt)}. Full access continues until then.`
              : "Payment is overdue — the workspace is read-only until it is confirmed."}
          </p>
        )}
        {(sub.status === "expired" || sub.status === "cancelled") && (
          <p className="text-muted-foreground">{readOnlyReason ?? "Your subscription is not active."} Choose a plan below to restore full access.</p>
        )}
        {sub.retentionEndsAt && (sub.status === "cancelled" || pendingCancel) && (
          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            Cancelled on {date(sub.cancelledAt)}. Your data is kept read-only and exportable until <span className="font-medium text-foreground">{date(sub.retentionEndsAt)}</span>, after which it may be deleted.
          </p>
        )}
      </div>

      <ul className="mt-5 grid gap-1.5 text-sm sm:grid-cols-2">
        {(Object.keys(FEATURE_LABELS) as (keyof PlanFeatures)[]).map((k) => (
          <li key={k} className={cn("flex items-center gap-2", !plan.features[k] && "text-muted-foreground/70")}>
            {plan.features[k] ? <Check className="size-4 text-success" /> : <Minus className="size-4" />} {FEATURE_LABELS[k]}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-4 mt-6">
        {(sub.status === "active" || sub.status === "past_due") && !sub.cancelledAt && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={sub.autoRenew} disabled={busy === "renew"} onCheckedChange={(v) => act("renew", { action: "auto_renew", autoRenew: v })} />
            Auto-renew
          </label>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {canResume && (
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act("resume", { action: "resume" })}>
              {busy === "resume" ? <Loader2 className="animate-spin" /> : <RotateCcw />} Resume subscription
            </Button>
          )}
          {canCancel && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={!!busy} onClick={() => setConfirmCancel(true)}>
              <XCircle /> Cancel subscription
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {keepsPeriod && periodEnd
                    ? `Your ${sub.planName} plan stays fully usable until ${date(periodEnd)} and will not renew.`
                    : "Your workspace becomes read-only immediately."}
                </p>
                <p>
                  All data stays available read-only and exportable until <strong>{date(retentionPreview)}</strong> (90 days). You can resume or choose a plan at any time
                  before then.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction onClick={() => act("cancel", { action: "cancel" })} className="bg-destructive text-white hover:bg-destructive/90">
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

// ───────────────────────────── Usage ─────────────────────────────

function UsageCard({ usage, plan }: { usage: BillingSummary["usage"]; plan: CurrentPlan }) {
  const rows = [
    { label: "Branches", used: usage.branches, max: plan.maxBranches },
    { label: "Team members", used: usage.employees, max: plan.maxEmployees },
    { label: "Products", used: usage.products, max: plan.maxProducts },
  ]
  return (
    <section className="space-y-5 rounded-xl border bg-card p-6">
      <div>
        <h2 className="font-semibold">Usage</h2>
        <p className="text-sm text-muted-foreground">Active records against your {plan.name} plan limits.</p>
      </div>
      {rows.map((u) => {
        const pct = u.max ? Math.min(100, (u.used / u.max) * 100) : 0
        return (
          <div key={u.label}>
            <div className="flex justify-between text-sm">
              <span>{u.label}</span>
              <span className={cn("num text-muted-foreground", u.max != null && u.used >= u.max && "font-medium text-warning")}>
                {integer(u.used)} / {u.max == null ? "Unlimited" : integer(u.max)}
              </span>
            </div>
            <Progress value={u.max == null ? 4 : pct} className={cn("mt-2 h-2", pct >= 90 && "[&>[data-slot=progress-indicator]]:bg-warning")} />
          </div>
        )
      })}
    </section>
  )
}

// ───────────────────────────── Plans ─────────────────────────────

const ACTION_LABEL = { current: "Current plan", upgrade: "Upgrade", downgrade: "Downgrade", choose: "Choose plan" } as const

function PlanPicker({ summary, onInvoice }: { summary: BillingSummary; onInvoice: (t: PaymentTarget) => void }) {
  const router = useRouter()
  const sub = summary.subscription
  const [cycle, setCycle] = useState<Cycle>(sub?.paidUp ? sub.billingCycle : "monthly")
  const [confirm, setConfirm] = useState<{ plan: PlanCard; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const maxSaving = Math.max(0, ...summary.plans.map((p) => (p.priceMonthly ? 1 - p.priceYearly / (p.priceMonthly * 12) : 0)))

  const checkout = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      const r = await api.post<PaymentTarget>("/api/v1/billing/checkout", { planId: confirm.plan.id, cycle }, { idempotencyKey: confirm.key })
      setConfirm(null)
      onInvoice(r)
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const kindOf = (p: PlanCard) => p.change[cycle]

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">Prices in BDT. Plan changes apply as soon as the payment is confirmed.</p>
        </div>
        <Tabs value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">
              Yearly {maxSaving > 0.01 && <span className="ml-1 text-xs text-success">save up to {Math.round(maxSaving * 100)}%</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.plans.map((p) => {
          const kind = kindOf(p)
          const isCurrent = sub?.planId === p.id
          const blocked = p.blockers.length > 0 && kind !== "current"
          const price = cycle === "yearly" ? p.priceYearly : p.priceMonthly
          const saving = cycle === "yearly" && p.priceMonthly ? 1 - p.priceYearly / (p.priceMonthly * 12) : 0
          return (
            <div key={p.id} className={cn("flex flex-col rounded-xl border bg-card p-5", isCurrent && "border-primary/50 ring-1 ring-primary/30")}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{p.name}</h3>
                {isCurrent && <StatusBadge tone="primary">Your plan</StatusBadge>}
              </div>
              {p.tagline && <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>}
              <p className="mt-4">
                <span className="num text-2xl font-semibold tracking-tight">{money(price)}</span>
                <span className="text-sm text-muted-foreground"> / {cycle === "yearly" ? "year" : "month"}</span>
              </p>
              <p className="h-4 text-xs text-success">{saving > 0.005 ? `Save ${Math.round(saving * 100)}% vs monthly` : ""}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" /> {p.maxBranches} branch{p.maxBranches > 1 ? "es" : ""}
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" /> {integer(p.maxEmployees)} team members
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" /> {p.maxProducts ? `${integer(p.maxProducts)} products` : "Unlimited products"}
                </li>
                {(Object.keys(FEATURE_LABELS) as (keyof PlanFeatures)[]).map((k) => (
                  <li key={k} className={cn("flex gap-2", !p.features[k] && "text-muted-foreground/60 line-through decoration-muted-foreground/30")}>
                    {p.features[k] ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : <Minus className="mt-0.5 size-4 shrink-0" />} {FEATURE_LABELS[k]}
                  </li>
                ))}
              </ul>
              {blocked && (
                <div className="mt-4 rounded-lg bg-destructive/8 p-3 text-xs text-destructive">
                  <p className="font-medium">Your current usage doesn&apos;t fit this plan:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {p.blockers.map((b) => (
                      <li key={b.resource}>{b.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                className="mt-5 w-full"
                variant={kind === "upgrade" || kind === "choose" ? "default" : "outline"}
                disabled={kind === "current" || blocked || price <= 0}
                onClick={() => setConfirm({ plan: p, key: crypto.randomUUID() })}
              >
                {kind === "choose" ? `Choose ${p.name}` : ACTION_LABEL[kind]}
              </Button>
            </div>
          )
        })}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm && kindOf(confirm.plan) === "choose" ? "Subscribe to" : confirm && kindOf(confirm.plan) === "upgrade" ? "Upgrade to" : "Switch to"} {confirm?.plan.name}{" "}
              ({cycle})
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  We&apos;ll issue an invoice for <strong className="num">{confirm ? money(cycle === "yearly" ? confirm.plan.priceYearly : confirm.plan.priceMonthly) : ""}</strong> and
                  show you how to pay it.
                </p>
                <p>
                  {sub?.status === "trialing"
                    ? "Your trial continues until the payment is confirmed; the paid period starts on the confirmation date."
                    : "Your new plan and billing period start when the payment is confirmed. Until then nothing changes."}
                </p>
                {summary.invoices.some((i) => i.status === "unpaid") && <p>Any earlier unpaid plan invoice is replaced by this one.</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button onClick={checkout} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Create invoice
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

// ───────────────────────────── History ─────────────────────────────

function InvoiceHistory({ invoices, onPay, opening }: { invoices: BillingSummary["invoices"]; onPay: (id: string) => void; opening: string | null }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Billing history</h2>
        <p className="text-sm text-muted-foreground">Download or print any invoice for your records.</p>
      </div>
      <DataTable
        rows={invoices}
        rowKey={(r) => r.id}
        pageSize={10}
        searchPlaceholder="Search invoices…"
        empty={
          <span className="inline-flex flex-col items-center gap-2">
            <Receipt className="size-6 text-muted-foreground/60" /> No invoices yet. Choosing a plan creates your first invoice.
          </span>
        }
        columns={[
          {
            key: "number",
            header: "Invoice",
            value: (r) => `${r.number} ${r.description ?? ""}`,
            cell: (r) => (
              <div>
                <p className="num font-medium">{r.number}</p>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
            ),
          },
          {
            key: "period",
            header: "Period",
            cell: (r) => <span className="text-xs whitespace-nowrap text-muted-foreground">{r.periodStart ? `${date(r.periodStart)} – ${date(r.periodEnd)}` : "—"}</span>,
          },
          { key: "issued", header: "Issued", value: (r) => r.issuedAt, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{date(r.issuedAt)}</span> },
          { key: "amount", header: "Amount", align: "right", value: (r) => r.amount, cell: (r) => <span className="num font-medium">{money(r.amount)}</span> },
          {
            key: "status",
            header: "Status",
            value: (r) => r.status,
            cell: (r) => (
              <div className="space-y-0.5">
                <StatusBadge tone={billingStatusTone(r.status)}>{BILLING_STATUS_LABELS[r.status as keyof typeof BILLING_STATUS_LABELS] ?? r.status}</StatusBadge>
                {r.status === "paid" && <p className="text-[11px] text-muted-foreground">{date(r.paidAt)}</p>}
                {r.status === "unpaid" && r.paymentReference && <p className="text-[11px] text-muted-foreground">Confirming</p>}
              </div>
            ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (r) => (
              <div className="flex justify-end gap-1">
                {r.status === "unpaid" && (
                  <Button size="sm" variant="outline" onClick={() => onPay(r.id)} disabled={opening === r.id}>
                    {opening === r.id ? <Loader2 className="animate-spin" /> : <CreditCard />} Pay
                  </Button>
                )}
                <Button size="icon-sm" variant="ghost" asChild aria-label={`Print ${r.number}`}>
                  <Link href={`/print/billing/${r.id}`} target="_blank">
                    <Printer />
                  </Link>
                </Button>
              </div>
            ),
          },
        ]}
      />
    </section>
  )
}
