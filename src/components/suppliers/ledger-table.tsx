import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge, type Tone } from "@/components/shared/status-badge"
import { date, money } from "@/lib/format"
import { cn } from "@/lib/utils"

export type LedgerRow = {
  id: string
  date: string
  type: string
  refType: string | null
  refId: string | null
  note: string | null
  debit: number
  credit: number
  balance: number
}

const TYPE: Record<string, { label: string; tone: Tone }> = {
  opening: { label: "Opening", tone: "neutral" },
  invoice: { label: "Invoice", tone: "info" },
  payment: { label: "Payment", tone: "success" },
  return: { label: "Return", tone: "warning" },
  credit_note: { label: "Credit note", tone: "warning" },
  refund: { label: "Refund", tone: "danger" },
  adjustment: { label: "Adjustment", tone: "neutral" },
  purchase: { label: "Purchase", tone: "primary" },
}

const REF_HREF: Record<string, string> = {
  invoice: "/app/sales/invoices/",
  money_receipt: "/app/sales/receipts/",
  receipt: "/app/sales/receipts/",
  sales_return: "/app/sales/returns/",
  return: "/app/sales/returns/",
  credit_note: "/app/sales/credit-notes/",
  lc: "/app/lc/",
  purchase_order: "/app/purchases/",
  po: "/app/purchases/",
}

/** Append-only ledger with running balance (balanceAfter). Negative balance = advance. */
export function LedgerTable({ rows, debitLabel, creditLabel, total }: { rows: LedgerRow[]; debitLabel: string; creditLabel: string; total: number }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="h-10 text-xs">Date</TableHead>
            <TableHead className="h-10 text-xs">Type</TableHead>
            <TableHead className="h-10 text-xs">Reference</TableHead>
            <TableHead className="h-10 text-right text-xs">{debitLabel}</TableHead>
            <TableHead className="h-10 text-right text-xs">{creditLabel}</TableHead>
            <TableHead className="h-10 text-right text-xs">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const t = TYPE[r.type] ?? { label: r.type, tone: "neutral" as Tone }
            const base = r.refType ? REF_HREF[r.refType] : undefined
            return (
              <TableRow key={r.id}>
                <TableCell className="py-2.5 text-xs whitespace-nowrap text-muted-foreground">{date(r.date)}</TableCell>
                <TableCell className="py-2.5">
                  <StatusBadge tone={t.tone}>{t.label}</StatusBadge>
                </TableCell>
                <TableCell className="max-w-[280px] py-2.5 text-sm">
                  <span className="line-clamp-2">{r.note ?? "—"}</span>
                  {base && r.refId && (
                    <Link href={`${base}${r.refId}`} className="text-xs text-primary hover:underline">
                      Open {r.refType?.replace(/_/g, " ")}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="num py-2.5 text-right">{r.debit ? money(r.debit) : ""}</TableCell>
                <TableCell className="num py-2.5 text-right">{r.credit ? money(r.credit) : ""}</TableCell>
                <TableCell className={cn("num py-2.5 text-right font-medium whitespace-nowrap", r.balance < 0 && "text-success")}>
                  {money(Math.abs(r.balance))}
                  {r.balance < 0 && <span className="ml-1 text-[11px] font-normal">Adv</span>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {total > rows.length && (
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          Showing the latest {rows.length} of {total} entries.
        </p>
      )}
    </div>
  )
}
