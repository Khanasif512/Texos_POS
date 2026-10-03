"use client"

import { useEffect, useState } from "react"
import { Eye, History, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errorMessage } from "@/lib/api-client"
import { date, dateTime, money, quantity } from "@/lib/format"
import { BASIS_LABEL } from "@/lib/validation/lc"
import type { SnapshotDetail } from "@/server/modules/lc/service"
import { percent, rate as fmtRate, unitMoney } from "./lc-format"

export type SnapshotRow = {
  id: string
  version: number
  basis: "weight" | "quantity"
  exchangeRate: number
  totalBaseCost: number
  totalExtraCost: number
  reason: string | null
  isCurrent: boolean
  createdAt: string
  createdBy: string
}

/** LC-06: every calculation is kept — who, when, why, with its full per-line result. */
export function SnapshotHistory({ lcId, rows }: { lcId: string; rows: SnapshotRow[] }) {
  const [viewing, setViewing] = useState<SnapshotRow | null>(null)
  if (!rows.length)
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <History className="size-5" />
        </span>
        <p className="mt-3 font-medium">No calculations saved yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Each saved or finalized landed-cost calculation appears here as a new version.</p>
      </div>
    )
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <ul className="divide-y">
        {rows.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex w-28 shrink-0 items-center gap-2">
              <span className="num font-semibold">v{s.version}</span>
              {s.isCurrent && <StatusBadge tone="success">Current</StatusBadge>}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate">{s.reason ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {BASIS_LABEL[s.basis]} · rate <span className="num">{fmtRate(s.exchangeRate)}</span> · {s.createdBy} · {dateTime(s.createdAt)}
              </p>
            </div>
            <div className="num text-sm sm:text-right">
              <p className="font-medium">{money(s.totalBaseCost + s.totalExtraCost)}</p>
              <p className="text-xs text-muted-foreground">extra {money(s.totalExtraCost)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewing(s)} className="w-fit">
              <Eye /> View
            </Button>
          </li>
        ))}
      </ul>
      {viewing && <SnapshotDialog lcId={lcId} row={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function SnapshotDialog({ lcId, row, onClose }: { lcId: string; row: SnapshotRow; onClose: () => void }) {
  const [data, setData] = useState<SnapshotDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api
      .get<SnapshotDetail>(`/api/v1/lc/${lcId}/snapshots/${row.id}`)
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
  }, [lcId, row.id])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Calculation v{row.version} {row.isCurrent && <StatusBadge tone="success">Current</StatusBadge>}
          </DialogTitle>
          <DialogDescription>
            {BASIS_LABEL[row.basis]} · rate {fmtRate(row.exchangeRate)} · {row.createdBy}, {dateTime(row.createdAt)}
            {row.reason && ` · “${row.reason}”`}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Share</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Base / unit</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Extra total</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Extra / unit</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Landed / unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{l.productName}</p>
                        <p className="text-xs text-muted-foreground">{l.sku}</p>
                      </td>
                      <td className="num px-3 py-2 text-right">{quantity(l.quantity)}</td>
                      <td className="num px-3 py-2 text-right text-muted-foreground">{percent(l.ratio)}</td>
                      <td className="num px-3 py-2 text-right">{unitMoney(l.baseUnitCost)}</td>
                      <td className="num px-3 py-2 text-right">{money(l.extraCostTotal)}</td>
                      <td className="num px-3 py-2 text-right">{unitMoney(l.extraUnitCost)}</td>
                      <td className="num px-3 py-2 text-right font-semibold">{unitMoney(l.landedUnitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Cost items used</p>
              <ul className="divide-y rounded-lg border text-sm">
                {data.costItems.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 px-3 py-2">
                    <span>
                      {c.label}
                      {c.description && <span className="text-muted-foreground"> — {c.description}</span>}
                      {c.entryDate && <span className="ml-2 text-xs text-muted-foreground">{date(c.entryDate)}</span>}
                    </span>
                    <span className="num">{money(c.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between bg-muted/30 px-3 py-2 font-medium">
                  <span>Total extra</span>
                  <span className="num">{money(data.totalExtraCost)}</span>
                </li>
                <li className="flex justify-between bg-muted/30 px-3 py-2">
                  <span className="text-muted-foreground">Base product value</span>
                  <span className="num">{money(data.totalBaseCost)}</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
