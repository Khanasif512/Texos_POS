"use client"

import Link from "next/link"
import { CheckCircle2, FileText, Printer, Plus, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { money } from "@/lib/format"

export type SaleResult = {
  id: string
  number: string
  type: "cash" | "credit"
  total: number
  paidAmount: number
  dueAmount: number
  challanId: string
  challanNumber: string
  receiptNumber: string | null
  creditOverride: boolean
  change: number
}

const openPrint = (path: string) => window.open(path, "_blank", "noopener")

/** Shown after a sale is confirmed. Esc (or New sale) starts the next sale. */
export function SaleSuccessDialog({ result, onNewSale }: { result: SaleResult | null; onNewSale: () => void }) {
  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onNewSale()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {result && (
          <>
            <DialogHeader className="items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
                <CheckCircle2 className="size-8" />
              </span>
              <DialogTitle className="mt-2 text-lg">Sale completed</DialogTitle>
              <DialogDescription>
                <span className="num font-medium text-foreground">{result.number}</span> ·{" "}
                {result.type === "cash" ? "Cash invoice" : "Credit invoice"} · Challan <span className="num">{result.challanNumber}</span>
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-2 rounded-xl border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="num font-semibold">{money(result.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="num">{money(result.paidAmount)}</dd>
              </div>
              {result.dueAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Due (added to customer ledger)</dt>
                  <dd className="num font-medium text-destructive">{money(result.dueAmount)}</dd>
                </div>
              )}
              {result.change > 0 && (
                <div className="flex justify-between border-t pt-2 text-base">
                  <dt className="font-medium">Change to return</dt>
                  <dd className="num font-semibold text-success">{money(result.change)}</dd>
                </div>
              )}
              {result.receiptNumber && (
                <p className="text-xs text-muted-foreground">
                  Payment recorded on money receipt <span className="num">{result.receiptNumber}</span>.
                </p>
              )}
              {result.creditOverride && <p className="text-xs font-medium text-warning">Credit limit was overridden — logged in the audit trail.</p>}
            </dl>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10" onClick={() => openPrint(`/print/invoice/${result.id}?auto=1`)}>
                <Printer /> Print invoice
              </Button>
              <Button variant="outline" className="h-10" onClick={() => openPrint(`/print/challan/${result.challanId}?auto=1`)}>
                <Truck /> Print challan
              </Button>
              <Button variant="ghost" className="h-10" asChild>
                <Link href={`/app/sales/invoices/${result.id}`}>
                  <FileText /> View invoice
                </Link>
              </Button>
              <Button className="h-10" onClick={onNewSale} autoFocus>
                <Plus /> New sale
                <kbd className="ml-1 rounded bg-primary-foreground/15 px-1.5 text-[10px] font-medium">Esc</kbd>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
