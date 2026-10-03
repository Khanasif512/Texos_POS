"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Calculator, CheckCircle2, Info, Loader2, Lock, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { StatusBadge } from "@/components/shared/status-badge"
import { useCan } from "@/components/app/app-context"
import { api, errorMessage } from "@/lib/api-client"
import { dateTime, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import { BASIS_LABEL, canCalculate, LC_COST_TYPE_LABEL } from "@/lib/validation/lc"
import type { PreviewEntry, SerializedResult } from "@/server/modules/lc/service"
import { kg, percent, rate as fmtRate, unitMoney } from "./lc-format"

type Basis = "weight" | "quantity"
type LineMeta = { id: string; productName: string; variationName: string; sku: string; unit: string }

/** LC-03 … LC-07: live comparison of both bases, per-product explanation, save / finalize / recalculate. */
export function LandedCostPanel({
  lcId,
  status,
  currency,
  exchangeRate,
  savedBasis,
  preview,
  lines,
  current,
  finalizedAt,
  costsChanged,
}: {
  lcId: string
  status: string
  currency: string
  exchangeRate: number
  savedBasis: Basis
  preview: { weight: PreviewEntry; quantity: PreviewEntry }
  lines: LineMeta[]
  current: { version: number; basis: Basis; createdAt: string; createdBy: string } | null
  finalizedAt: string | null
  costsChanged: boolean
}) {
  const canFinalize = useCan("lc.finalize")
  const [basis, setBasis] = useState<Basis>(current?.basis ?? savedBasis)
  const [lineId, setLineId] = useState(lines[0]?.id ?? "")
  const [dialog, setDialog] = useState<"save" | "finalize" | null>(null)
  const meta = new Map(lines.map((l) => [l.id, l]))
  const selected = preview[basis]

  const calcAllowed = canCalculate(status)
  const action =
    !canFinalize || !calcAllowed
      ? null
      : status === "received"
        ? "received"
        : "finalized"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calculator className="size-5" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">
              {status === "cost_finalized" || status === "closed"
                ? `Finalized${finalizedAt ? ` on ${dateTime(finalizedAt)}` : ""}${current ? ` · current calculation v${current.version}` : ""}`
                : status === "received"
                  ? current
                    ? `Calculation v${current.version} saved — not yet finalized`
                    : "Goods received — compare the bases, then finalize"
                  : "Preview — calculation can be saved after the goods are received"}
            </p>
            <p className="text-muted-foreground">
              {exchangeRate > 0 ? (
                <>
                  Rate 1 {currency} = <span className="num">{fmtRate(exchangeRate)}</span> BDT · click a basis to inspect it
                </>
              ) : (
                "Enter the exchange rate on the LC to see BDT costs."
              )}
            </p>
          </div>
        </div>
        {action && (
          <div className="flex flex-wrap gap-2">
            {action === "received" ? (
              <>
                <Button variant="outline" onClick={() => setDialog("save")} disabled={!selected.ok}>
                  <Save /> Save calculation
                </Button>
                <Button onClick={() => setDialog("finalize")} disabled={!selected.ok}>
                  <CheckCircle2 /> Finalize landed cost
                </Button>
              </>
            ) : (
              <Button onClick={() => setDialog("save")} disabled={!selected.ok} variant={costsChanged ? "default" : "outline"}>
                <RefreshCw /> Recalculate
              </Button>
            )}
          </div>
        )}
        {status === "closed" && (
          <StatusBadge>
            <Lock className="size-3" /> Closed — reopen to recalculate
          </StatusBadge>
        )}
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        {(["weight", "quantity"] as const).map((b) => (
          <BasisCard
            key={b}
            basis={b}
            entry={preview[b]}
            meta={meta}
            active={basis === b}
            saved={current ? current.basis === b : savedBasis === b}
            savedLabel={current ? `Used in v${current.version}` : "Saved choice"}
            onSelect={() => setBasis(b)}
          />
        ))}
      </div>

      {selected.ok && lines.length > 0 && (
        <Breakdown result={selected.result} meta={meta} lineId={lineId} onLine={setLineId} basis={basis} />
      )}

      {dialog && selected.ok && (
        <CalculationDialog
          lcId={lcId}
          mode={dialog === "finalize" ? "finalize" : status === "cost_finalized" ? "recalculate" : "save"}
          basis={basis}
          onBasis={setBasis}
          preview={preview}
          meta={meta}
          nextVersion={(current?.version ?? 0) + 1}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function BasisCard({
  basis,
  entry,
  meta,
  active,
  saved,
  savedLabel,
  onSelect,
}: {
  basis: Basis
  entry: PreviewEntry
  meta: Map<string, LineMeta>
  active: boolean
  saved: boolean
  savedLabel: string
  onSelect: () => void
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-shadow",
        active ? "border-primary/60 shadow-sm ring-2 ring-primary/20" : "cursor-pointer hover:border-foreground/20",
      )}
      onClick={active ? undefined : onSelect}
      aria-label={BASIS_LABEL[basis]}
    >
      <div className={cn("flex items-center justify-between gap-2 border-b px-4 py-3", active && "bg-primary/5")}>
        <div>
          <h3 className="font-semibold">{BASIS_LABEL[basis]}</h3>
          <p className="text-xs text-muted-foreground">
            {basis === "weight" ? "Extra cost ∝ unit weight × quantity" : "Extra cost ∝ quantity (pieces)"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {saved && <StatusBadge tone="success">{savedLabel}</StatusBadge>}
          {active ? <StatusBadge tone="primary">Viewing</StatusBadge> : <span className="text-xs text-muted-foreground">Click to view</span>}
        </div>
      </div>
      {!entry.ok ? (
        <div className="flex items-start gap-2.5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-muted-foreground">{entry.error}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Share</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Extra total</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Base / unit</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Extra / unit</th>
                  <th className="px-4 py-2 text-right font-medium whitespace-nowrap">Landed / unit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entry.result.lines.map((l) => {
                  const m = meta.get(l.lcLineId)
                  return (
                    <tr key={l.lcLineId}>
                      <td className="px-4 py-2.5">
                        <p className="line-clamp-1 font-medium">{m?.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {m?.variationName} · {quantity(l.quantity)} {m?.unit}
                          {basis === "weight" && ` · ${kg(l.lineWeight)}`}
                        </p>
                      </td>
                      <td className="num px-3 py-2.5 text-right text-muted-foreground">{percent(l.ratio)}</td>
                      <td className="num px-3 py-2.5 text-right">{money(l.extraCostTotal)}</td>
                      <td className="num px-3 py-2.5 text-right text-muted-foreground">{money(l.baseUnitCost)}</td>
                      <td className="num px-3 py-2.5 text-right">{money(l.extraUnitCost)}</td>
                      <td className="num px-4 py-2.5 text-right font-semibold">{money(l.landedUnitCost)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 text-sm">
                  <td className="px-4 py-2.5 font-medium">Total</td>
                  <td className="num px-3 py-2.5 text-right text-muted-foreground">100%</td>
                  <td className="num px-3 py-2.5 text-right font-medium">{money(entry.result.totalExtraCost)}</td>
                  <td colSpan={3} className="num px-4 py-2.5 text-right text-xs text-muted-foreground">
                    Base {money(entry.result.totalBaseCost)} + extra = <span className="font-semibold text-foreground">{money(entry.result.totalLandedCost)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {entry.result.warnings.length > 0 && (
            <ul className="space-y-1 border-t px-4 py-2.5 text-xs text-warning">
              {entry.result.warnings.map((w) => (
                <li key={w.lcLineId} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {meta.get(w.lcLineId)?.productName}: {w.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** Acceptance criterion 3: for any product, which cost items and what proportion built its landed cost. */
function Breakdown({
  result,
  meta,
  lineId,
  onLine,
  basis,
}: {
  result: SerializedResult
  meta: Map<string, LineMeta>
  lineId: string
  onLine: (id: string) => void
  basis: Basis
}) {
  const line = result.lines.find((l) => l.lcLineId === lineId) ?? result.lines[0]
  if (!line) return null
  const m = meta.get(line.lcLineId)
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">How this landed cost is built</h3>
          <p className="text-sm text-muted-foreground">
            {BASIS_LABEL[basis]}: this product carries <span className="num font-medium text-foreground">{percent(line.ratio)}</span> of every cost item
            {basis === "weight"
              ? ` (${kg(line.lineWeight)} of ${kg(result.totalWeight)})`
              : ` (${quantity(line.quantity)} of ${quantity(result.totalQuantity)} units)`}
            .
          </p>
        </div>
        <Select value={line.lcLineId} onValueChange={onLine}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {result.lines.map((l) => {
              const lm = meta.get(l.lcLineId)
              return (
                <SelectItem key={l.lcLineId} value={l.lcLineId}>
                  {lm?.productName} — {lm?.variationName}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Cost item</th>
              <th className="px-3 py-2 text-right font-medium">Item amount</th>
              <th className="px-3 py-2 text-right font-medium">× Share</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">= This product</th>
              <th className="px-4 py-2 text-right font-medium whitespace-nowrap">Per {m?.unit ?? "unit"}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {line.breakdown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No cost items yet — the landed cost equals the base cost.
                </td>
              </tr>
            )}
            {line.breakdown.map((b) => (
              <tr key={b.costItemId}>
                <td className="px-4 py-2">
                  <p>{LC_COST_TYPE_LABEL[b.costType] ?? b.costType}</p>
                  {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
                </td>
                <td className="num px-3 py-2 text-right text-muted-foreground">{money(b.amount)}</td>
                <td className="num px-3 py-2 text-right text-muted-foreground">{percent(line.ratio)}</td>
                <td className="num px-3 py-2 text-right">{money(b.lineAmount)}</td>
                <td className="num px-4 py-2 text-right">{unitMoney(b.unitAmount)}</td>
              </tr>
            ))}
            {line.rounding !== 0 && (
              <tr className="text-muted-foreground">
                <td className="px-4 py-2 text-xs" colSpan={3}>
                  Rounding adjustment (keeps the LC total exact to the paisa)
                </td>
                <td className="num px-3 py-2 text-right text-xs">{money(line.rounding)}</td>
                <td />
              </tr>
            )}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="px-4 py-2 font-medium" colSpan={3}>
                Extra cost for this product
              </td>
              <td className="num px-3 py-2 text-right font-medium">{money(line.extraCostTotal)}</td>
              <td className="num px-4 py-2 text-right font-medium">{unitMoney(line.extraUnitCost)}</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-muted-foreground" colSpan={3}>
                Base cost (unit price × rate)
              </td>
              <td className="num px-3 py-2 text-right text-muted-foreground">{money(line.baseTotal)}</td>
              <td className="num px-4 py-2 text-right text-muted-foreground">{unitMoney(line.baseUnitCost)}</td>
            </tr>
            <tr className="text-base">
              <td className="px-4 py-2.5 font-semibold" colSpan={3}>
                Landed cost
              </td>
              <td className="num px-3 py-2.5 text-right font-semibold">{money(line.landedTotal)}</td>
              <td className="num px-4 py-2.5 text-right font-semibold text-primary">{unitMoney(line.landedUnitCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function CalculationDialog({
  lcId,
  mode,
  basis,
  onBasis,
  preview,
  meta,
  nextVersion,
  onClose,
}: {
  lcId: string
  mode: "save" | "finalize" | "recalculate"
  basis: Basis
  onBasis: (b: Basis) => void
  preview: { weight: PreviewEntry; quantity: PreviewEntry }
  meta: Map<string, LineMeta>
  nextVersion: number
  onClose: () => void
}) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [key] = useState(() => crypto.randomUUID())
  const entry = preview[basis]
  const needsReason = mode === "recalculate"

  const submit = async () => {
    setBusy(true)
    try {
      const url = mode === "finalize" ? `/api/v1/lc/${lcId}/finalize` : `/api/v1/lc/${lcId}/snapshots`
      const res = await api.post<{ version: number; revaluedBatches: number }>(url, { basis, reason: reason || null }, { idempotencyKey: `${key}:${basis}` })
      toast.success(
        mode === "finalize" ? `Landed cost finalized (v${res.version})` : `Calculation v${res.version} saved`,
        res.revaluedBatches ? { description: `${res.revaluedBatches} stock batch(es) revalued to the new cost.` } : undefined,
      )
      onClose()
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "finalize" ? "Finalize landed cost" : mode === "recalculate" ? "Recalculate landed cost" : "Save calculation"}</DialogTitle>
          <DialogDescription>
            {mode === "finalize"
              ? `Saves calculation v${nextVersion}, marks the LC Cost finalized and posts the product value to the supplier's payable.`
              : mode === "recalculate"
                ? `Creates calculation v${nextVersion}. Remaining stock from this LC takes the new cost; units already sold keep theirs, and the supplier payable is adjusted by any change in product value.`
                : `Saves calculation v${nextVersion} so goods can be received at this cost. You can still finalize later.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Distribution basis" required>
            <RadioGroup value={basis} onValueChange={(v) => onBasis(v as Basis)} className="grid-cols-2">
              {(["weight", "quantity"] as const).map((b) => (
                <label
                  key={b}
                  className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm", basis === b && "border-primary bg-primary/5")}
                >
                  <RadioGroupItem value={b} disabled={!preview[b].ok} />
                  {BASIS_LABEL[b]}
                </label>
              ))}
            </RadioGroup>
          </Field>
          {entry.ok ? (
            <div className="rounded-lg border">
              <ul className="divide-y text-sm">
                {entry.result.lines.map((l) => (
                  <li key={l.lcLineId} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">
                      {meta.get(l.lcLineId)?.productName} <span className="text-muted-foreground">— {meta.get(l.lcLineId)?.variationName}</span>
                    </span>
                    <span className="num shrink-0 font-medium">{unitMoney(l.landedUnitCost)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total landed</span>
                <span className="num font-semibold">{money(entry.result.totalLandedCost)}</span>
              </div>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              {entry.error}
            </p>
          )}
          <Field
            label="Reason"
            htmlFor="calc-reason"
            required={needsReason}
            hint={needsReason ? "Recorded with the new calculation (LC-07), e.g. “Customs duty corrected after assessment”." : "Optional note for the calculation history."}
          >
            <Textarea id="calc-reason" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {mode !== "save" && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Sold units keep the cost on their invoices; only unsold stock is revalued.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !entry.ok || (needsReason && reason.trim().length < 3)}>
            {busy ? <Loader2 className="animate-spin" /> : mode === "finalize" ? <CheckCircle2 /> : <Save />}
            {mode === "finalize" ? "Finalize" : `Save v${nextVersion}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
