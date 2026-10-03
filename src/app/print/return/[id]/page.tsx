import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintSheet } from "@/components/shared/print-toolbar"
import { DocPrintToolbar } from "@/components/sales/doc-print-toolbar"
import { Letterhead, Signatures, Watermark } from "@/components/sales/letterhead"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { amountInWords } from "@/server/modules/sales-after/calc"
import { returnDetail } from "@/server/modules/sales-after/queries"
import { getLetterhead } from "@/server/modules/sales/queries"
import { amount, date, dateTime, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Return" }

/** Return slip (cash refund) or credit note for an approved return; pending/rejected returns print with a stamp. */
export default async function ReturnPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const ctx = await requireTenant(`/print/return/${id}`)
  ensurePermission(ctx, "sales.view", "sales.return", "sales.return_approve")
  const r = await returnDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const company = await getLetterhead(ctx.companyId)
  const isCn = r.status === "approved" && r.creditNote
  const title = isCn ? "CREDIT NOTE" : r.refundMode === "cash" ? "RETURN & REFUND SLIP" : "SALES RETURN"
  const customerName = r.customer?.name ?? r.invoice?.customerName ?? "Walk-in customer"

  return (
    <>
      <DocPrintToolbar title={`${isCn ? "Credit note" : "Return"} ${r.creditNote?.number ?? r.number}`} endpoint={`/api/v1/returns/${r.id}/print`} auto={sp.auto === "1"} />
      <PrintSheet>
        <div className="relative">
          {r.status === "pending" && <Watermark text="PENDING" />}
          {r.status === "rejected" && <Watermark text="REJECTED" tone="danger" />}
          <Letterhead
            company={company}
            title={title}
            meta={[
              ...(isCn ? ([["Credit note", r.creditNote!.number]] as [string, string][]) : []),
              ["Return no.", r.number],
              ["Date", date(r.approvedAt ?? r.date)],
              ["Invoice", r.invoice?.number ?? "—"],
            ]}
          />

          <div className="mt-5 grid grid-cols-2 gap-6 text-xs">
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">Customer</p>
              <p className="mt-1 text-sm font-semibold">{customerName}</p>
              {r.customer?.phone && <p>{r.customer.phone}</p>}
              {r.customer?.address && <p className="text-neutral-600">{r.customer.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">Reason</p>
              <p className="mt-1">{r.reason ?? "—"}</p>
              <p className="mt-1 text-neutral-600">{r.restock ? "Goods returned to stock" : "Goods not restocked"}</p>
            </div>
          </div>

          <table className="mt-5 w-full text-xs">
            <thead>
              <tr className="border-y border-neutral-800 text-left">
                <th className="py-1.5 pr-2 font-semibold">#</th>
                <th className="py-1.5 pr-2 font-semibold">Item</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Qty</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Unit price</th>
                <th className="py-1.5 text-right font-semibold">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l, i) => (
                <tr key={l.id} className="border-b border-neutral-200 align-top">
                  <td className="py-1.5 pr-2">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    {l.productName} — {l.variationName}
                    <span className="block text-[10px] text-neutral-500">{l.sku}</span>
                  </td>
                  <td className="num py-1.5 pr-2 text-right">
                    {quantity(l.quantity)} {l.unit}
                  </td>
                  <td className="num py-1.5 pr-2 text-right">{amount(l.unitPrice)}</td>
                  <td className="num py-1.5 text-right">{amount(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="py-2 pr-2 text-right font-semibold">
                  {isCn ? "Credit amount" : r.refundMode === "cash" ? "Refund amount" : "Return value"}
                </td>
                <td className="num py-2 text-right text-sm font-bold">{amount(r.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-2 text-xs">
            <span className="text-neutral-500">In words: </span>
            <span className="italic">{amountInWords(r.totalAmount)}</span>
          </p>
          {isCn && (
            <p className="mt-2 text-xs text-neutral-600">
              This amount has been credited to the customer&apos;s account and is adjusted against dues on {r.invoice?.number ?? "their invoices"} first.
            </p>
          )}

          <Signatures left="Customer's signature" right={`Authorised by${r.decidedBy && r.status === "approved" ? ` (${r.decidedBy})` : ""}`} />
          <p className="mt-6 text-center text-[10px] text-neutral-400">Printed {dateTime(new Date())}</p>
        </div>
      </PrintSheet>
    </>
  )
}
