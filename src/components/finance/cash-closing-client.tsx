"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Lock, RefreshCw } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Field } from "@/components/shared/field"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errorMessage } from "@/lib/api-client"
import { date, dateTime, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CashDayReport, ClosingHistoryRow } from "@/server/modules/finance/cash-closing"
import { BranchSelect, SignedMoney, dayDate, todayKey } from "./shared"

const cents = (v: number) => Math.round(v * 100)
const fromCents = (v: number) => v / 100

function shift(key: string, n: number) {
  const d = dayDate(key)
  d.setDate(d.getDate() + n)
  return todayKey(d)
}

export function CashClosingClient({
  initialBranchId,
  initialDate,
  history,
  canClose,
  isOwner,
}: {
  initialBranchId: string
  initialDate: string
  history: ClosingHistoryRow[]
  canClose: boolean
  isOwner: boolean
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const today = todayKey()
  const [branchId, setBranchId] = useState(initialBranchId)
  const [day, setDay] = useState(initialDate)
  const key = ["cash-day", branchId, day]
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => api.get<CashDayReport>(`/api/v1/cash-closings/preview?branchId=${branchId}&date=${day}`),
    enabled: !!branchId,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <BranchSelect value={branchId} onChange={setBranchId} className="h-9 sm:w-[220px]" />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-9" onClick={() => setDay(shift(day, -1))} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <Input type="date" className="h-9 w-[160px]" max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Day" />
          <Button variant="outline" size="icon" className="size-9" disabled={day >= today} onClick={() => setDay(shift(day, 1))} aria-label="Next day">
            <ChevronRight />
          </Button>
          {day !== today && (
            <Button variant="ghost" size="sm" onClick={() => setDay(today)}>
              Today
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" className="sm:ml-auto" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn(isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {errorMessage(error)}{" "}
          <Button variant="link" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : (
        <DayView
          key={`${branchId}-${day}-${data.closing?.id ?? "open"}`}
          data={data}
          canClose={canClose}
          isOwner={isOwner}
          onClosed={() => {
            qc.invalidateQueries({ queryKey: key })
            router.refresh()
          }}
        />
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Recent closings</h2>
          <p className="text-xs text-muted-foreground">Last 30 closings in your branches. Click one to open it.</p>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No days closed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Branch</TableHead>
                  <TableHead className="text-right text-xs">Opening</TableHead>
                  <TableHead className="text-right text-xs">Cash in</TableHead>
                  <TableHead className="text-right text-xs">Cash out</TableHead>
                  <TableHead className="text-right text-xs">Expected</TableHead>
                  <TableHead className="text-right text-xs">Counted</TableHead>
                  <TableHead className="text-right text-xs">Over / short</TableHead>
                  <TableHead className="text-xs">Closed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow
                    key={h.id}
                    className={cn("cursor-pointer", h.branchId === branchId && h.date === day && "bg-primary/5")}
                    onClick={() => {
                      setBranchId(h.branchId)
                      setDay(h.date)
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }}
                  >
                    <TableCell className="whitespace-nowrap">{date(dayDate(h.date))}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{h.branchName}</TableCell>
                    <TableCell className="num text-right">{money(h.openingCash)}</TableCell>
                    <TableCell className="num text-right">{money(h.cashIn)}</TableCell>
                    <TableCell className="num text-right">{money(h.cashOut)}</TableCell>
                    <TableCell className="num text-right">{money(h.expectedClosing)}</TableCell>
                    <TableCell className="num text-right font-medium">{money(h.countedCash)}</TableCell>
                    <TableCell className="text-right">
                      {h.difference === 0 ? <StatusBadge tone="success">Balanced</StatusBadge> : <SignedMoney value={h.difference} />}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{h.closedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

function DayView({ data, canClose, isOwner, onClosed }: { data: CashDayReport; canClose: boolean; isOwner: boolean; onClosed: () => void }) {
  const closing = data.closing
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [])
  const [opening, setOpening] = useState(String(closing?.openingCash ?? data.figures.openingCash))
  const [counted, setCounted] = useState(closing ? String(closing.countedCash) : "")
  const [note, setNote] = useState(closing?.note ?? "")
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const openingEditable = data.isFirst && !closing
  const openingValue = openingEditable ? Number(opening) || 0 : data.figures.openingCash
  const f = data.figures
  const expected = fromCents(cents(openingValue) + cents(f.cashSales) + cents(f.cashReceipts) - cents(f.cashExpenses) - cents(f.cashPayouts))
  const countedNum = counted === "" ? null : Number(counted)
  const diff = countedNum == null || Number.isNaN(countedNum) ? null : fromCents(cents(countedNum) - cents(expected))
  const editable = canClose && (!closing || isOwner)

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.post<{ reclosed: boolean; difference: number }>(
        "/api/v1/cash-closings",
        { branchId: data.branch?.id, date: data.date, openingCash: openingEditable ? openingValue : null, countedCash: countedNum, note },
        { idempotencyKey: closing ? `${idempotencyKey}-${counted}-${note}` : idempotencyKey },
      )
      toast.success(res.reclosed ? "Day re-closed" : "Day closed", {
        description: res.difference === 0 ? "Cash is balanced." : `${res.difference > 0 ? "Over" : "Short"} by ${money(Math.abs(res.difference))}.`,
      })
      onClosed()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
      setConfirm(false)
    }
  }

  const lines: { label: string; value: number; sign: "+" | "−" | ""; hint: string; strong?: boolean }[] = [
    { label: "Cash sales", value: f.cashSales, sign: "+", hint: `${data.breakdown.sales.length} cash invoice(s)` },
    { label: "Cash receipts", value: f.cashReceipts, sign: "+", hint: `${data.breakdown.receipts.length} money receipt(s)` },
    { label: "Cash expenses", value: f.cashExpenses, sign: "−", hint: `${data.breakdown.expenses.length} expense(s)` },
    { label: "Cash payouts", value: f.cashPayouts, sign: "−", hint: "Supplier payments & cash refunds" },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">
                {data.branch?.name} · {date(dayDate(data.date))}
              </h2>
              <p className="text-xs text-muted-foreground">
                {data.previous ? `Opening = counted cash of ${date(dayDate(data.previous.date))}` : "First closing for this branch — enter the opening cash."}
              </p>
            </div>
            {closing ? (
              <StatusBadge tone="success">
                <Lock className="size-2.5" /> Closed
              </StatusBadge>
            ) : (
              <StatusBadge tone="warning">Open</StatusBadge>
            )}
          </div>
          <dl className="divide-y text-sm">
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <dt>
                Opening cash
                {openingEditable && <p className="text-xs text-muted-foreground">Cash in the drawer before the first closing</p>}
              </dt>
              <dd>
                {openingEditable && canClose ? (
                  <Input type="number" inputMode="decimal" step="0.01" min="0" className="num h-8 w-36 text-right" value={opening} onChange={(e) => setOpening(e.target.value)} aria-label="Opening cash" />
                ) : (
                  <span className="num font-medium">{money(openingValue)}</span>
                )}
              </dd>
            </div>
            {lines.map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-4 px-5 py-3">
                <dt>
                  {l.label}
                  <p className="text-xs text-muted-foreground">{l.hint}</p>
                </dt>
                <dd className={cn("num", l.sign === "−" && l.value > 0 && "text-destructive")}>
                  {l.value > 0 ? `${l.sign} ` : ""}
                  {money(l.value)}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 bg-muted/40 px-5 py-3.5">
              <dt className="font-semibold">Expected closing cash</dt>
              <dd className="num text-lg font-semibold">{money(expected)}</dd>
            </div>
          </dl>
        </section>

        <Breakdown data={data} />
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Count &amp; close</h2>
          {closing && (
            <p className="mt-1 text-xs text-muted-foreground">
              Closed by {closing.closedBy ?? "—"} on {dateTime(closing.closedAt)}.
            </p>
          )}
          {closing?.stale && (
            <p className="mt-3 flex gap-2 rounded-lg bg-warning/10 p-3 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              Entries changed after closing: expected cash was {money(closing.expectedClosing)} at closing, now {money(f.expectedClosing)}.
              {isOwner ? " Re-close the day to update it." : " Ask the owner to re-close the day."}
            </p>
          )}
          <div className="mt-4 grid gap-4">
            <Field label="Counted cash (৳)" htmlFor="counted" required>
              <Input
                id="counted"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="num h-11 text-lg"
                value={counted}
                disabled={!editable}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                diff != null && diff === 0 && "border-success/40 bg-success/5",
                diff != null && diff !== 0 && "border-destructive/30 bg-destructive/5",
              )}
            >
              <span className="text-sm">{diff == null ? "Difference" : diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short"}</span>
              {diff == null ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : diff === 0 ? (
                <CheckCircle2 className="size-5 text-success" />
              ) : (
                <SignedMoney value={diff} className="text-base font-semibold" />
              )}
            </div>
            <Field label="Note" htmlFor="note" hint={diff ? "Explain the over / short amount." : undefined}>
              <Input id="note" value={note} maxLength={255} disabled={!editable} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {canClose && (
              <Button
                className="h-10"
                disabled={!editable || countedNum == null || Number.isNaN(countedNum) || countedNum < 0 || saving}
                onClick={() => (closing ? setConfirm(true) : save())}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Lock />}
                {closing ? "Re-close day" : "Close day"}
              </Button>
            )}
            {closing && !isOwner && <p className="text-xs text-muted-foreground">Only the owner can re-close a closed day.</p>}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Daily expense summary</h2>
            <p className="text-xs text-muted-foreground">All expenses of the day by category.</p>
          </div>
          {data.expenseSummary.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No expenses recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-right text-xs">Cash</TableHead>
                  <TableHead className="text-right text-xs">Other</TableHead>
                  <TableHead className="text-right text-xs">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenseSummary.map((s) => (
                  <TableRow key={s.categoryId}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="num text-right">{money(s.cash)}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">{money(s.other)}</TableCell>
                    <TableCell className="num text-right font-medium">{money(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">Total</TableCell>
                  <TableCell className="num text-right">{money(fromCents(data.expenseSummary.reduce((a, s) => a + cents(s.cash), 0)))}</TableCell>
                  <TableCell className="num text-right">{money(fromCents(data.expenseSummary.reduce((a, s) => a + cents(s.other), 0)))}</TableCell>
                  <TableCell className="num text-right font-semibold">{money(fromCents(data.expenseSummary.reduce((a, s) => a + cents(s.total), 0)))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </section>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-close this day?</AlertDialogTitle>
            <AlertDialogDescription>
              The stored closing is replaced with today&apos;s figures and counted cash {money(countedNum ?? 0)}. The change is recorded in the audit log.
              Later days keep their own opening cash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={save}>Re-close day</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Breakdown({ data }: { data: CashDayReport }) {
  const b = data.breakdown
  const tabs = [
    { key: "sales", label: "Cash sales", rows: b.sales.map((r) => ({ id: r.id, number: r.number, party: r.party, detail: dateTime(r.at), amount: r.amount })) },
    { key: "receipts", label: "Receipts", rows: b.receipts.map((r) => ({ id: r.id, number: r.number, party: r.party, detail: r.reference ?? dateTime(r.at), amount: r.amount })) },
    { key: "expenses", label: "Expenses", rows: b.expenses.map((r) => ({ id: r.id, number: r.number, party: r.party, detail: r.description ?? "", amount: r.amount })) },
    { key: "payouts", label: "Payouts", rows: b.payouts.map((r) => ({ id: r.id, number: r.number, party: r.party, detail: r.kind, amount: r.amount })) },
  ]
  return (
    <section className="rounded-xl border bg-card">
      <Tabs defaultValue="sales" className="gap-0">
        <div className="overflow-x-auto border-b px-3 py-3">
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">
                {t.label} <span className="num ml-1 text-muted-foreground">{t.rows.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {t.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing in cash for this day.</p>
            ) : (
              <div className="max-h-[360px] overflow-auto">
                <Table>
                  <TableBody>
                    {t.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="num w-[150px] text-xs font-medium">{r.number}</TableCell>
                        <TableCell>
                          <p className="truncate">{r.party}</p>
                          {r.detail && <p className="truncate text-xs text-muted-foreground">{r.detail}</p>}
                        </TableCell>
                        <TableCell className="num text-right">{money(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
