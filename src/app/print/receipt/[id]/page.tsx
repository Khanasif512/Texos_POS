import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintSheet } from "@/components/shared/print-toolbar"
import { DocPrintToolbar } from "@/components/sales/doc-print-toolbar"
import { Letterhead, Signatures, Watermark } from "@/components/sales/letterhead"
import { methodLabel } from "@/components/sales-after/badges"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { amountInWords } from "@/server/modules/sales-after/calc"
import { receiptDetail } from "@/server/modules/sales-after/queries"
import { getLetterhead } from "@/server/modules/sales/queries"
import { amount, date, dateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Money receipt" }

/** MONEY RECEIPT (SLS-04). Each print is recorded; copies after the first carry a REPRINT mark. */
export default async function ReceiptPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const ctx = await requireTenant(`/print/receipt/${id}`)
  ensurePermission(ctx, "sales.view", "sales.receipt")
  const r = await receiptDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const company = await getLetterhead(ctx.companyId)
  const cancelled = !!r.cancelledAt

  return (
    <>
      <DocPrintToolbar title={`Money receipt ${r.number}`} endpoint={`/api/v1/receipts/${r.id}/print`} auto={sp.auto === "1"} />
      <PrintSheet>
        <div className="relative">
          {cancelled ? <Watermark text="CANCELLED" tone="danger" /> : r.printCount > 0 && <Watermark text="REPRINT" />}
          <Letterhead
            company={company}
            title="MONEY RECEIPT"
            meta={[
              ["Receipt no.", r.number],
              ["Date", date(r.date)],
              ["Branch", r.branchName],
            ]}
          />

          <div className="mt-6 space-y-3 text-[14px] leading-relaxed">
            <p className="flex flex-wrap gap-x-2 border-b border-dotted border-neutral-400 pb-1">
              <span className="text-neutral-500">Received with thanks from</span>
              <span className="font-semibold">{r.customer?.name ?? "—"}</span>
              {r.customer?.code && <span className="text-neutral-500">({r.customer.code})</span>}
            </p>
            {(r.customer?.phone || r.customer?.address) && (
              <p className="border-b border-dotted border-neutral-400 pb-1 text-[13px] text-neutral-700">
                {[r.customer?.phone, r.customer?.address].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="flex flex-wrap gap-x-2 border-b border-dotted border-neutral-400 pb-1">
              <span className="text-neutral-500">The sum of</span>
              <span className="font-medium italic">{amountInWords(r.amount)}</span>
            </p>
            <p className="flex flex-wrap gap-x-6 border-b border-dotted border-neutral-400 pb-1">
              <span>
                <span className="text-neutral-500">By </span>
                <span className="font-medium">{methodLabel(r.method)}</span>
              </span>
              {r.reference && (
                <span>
                  <span className="text-neutral-500">Ref. </span>
                  <span className="font-medium">{r.reference}</span>
                </span>
              )}
              <span>
                <span className="text-neutral-500">Against </span>
                <span className="font-medium">
                  {r.allocations.length ? r.allocations.map((a) => a.number).join(", ") : "Advance / on account"}
                </span>
              </span>
            </p>
          </div>

          <div className="mt-5 flex items-start justify-between gap-6">
            {r.allocations.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-y border-neutral-800 text-left">
                    <th className="py-1.5 pr-2 font-semibold">Invoice</th>
                    <th className="py-1.5 pr-2 font-semibold">Date</th>
                    <th className="py-1.5 pr-2 text-right font-semibold">Invoice total (৳)</th>
                    <th className="py-1.5 pr-2 text-right font-semibold">Due now (৳)</th>
                    <th className="py-1.5 text-right font-semibold">Received (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  {r.allocations.map((a) => (
                    <tr key={a.id} className="border-b border-neutral-200">
                      <td className="num py-1.5 pr-2">{a.number}</td>
                      <td className="py-1.5 pr-2">{date(a.invoiceDate)}</td>
                      <td className="num py-1.5 pr-2 text-right">{amount(a.invoiceTotal)}</td>
                      <td className="num py-1.5 pr-2 text-right font-medium">{amount(a.dueNow)}</td>
                      <td className="num py-1.5 text-right">{amount(a.amount)}</td>
                    </tr>
                  ))}
                  {r.unallocated > 0 && (
                    <tr className="border-b border-neutral-200">
                      <td className="py-1.5 pr-2" colSpan={4}>
                        Advance (on account)
                      </td>
                      <td className="num py-1.5 text-right">{amount(r.unallocated)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div />
            )}
            <div className="shrink-0 rounded border-2 border-neutral-800 px-5 py-3 text-right">
              <p className="text-[11px] tracking-wide text-neutral-500 uppercase">Amount</p>
              <p className="num text-2xl font-bold">৳ {amount(r.amount)}</p>
            </div>
          </div>

          {r.note && <p className="mt-4 text-xs text-neutral-600">Note: {r.note}</p>}

          <Signatures left="Customer's signature" right={`Received by${r.createdBy ? ` (${r.createdBy})` : ""}`} />
          <p className="mt-6 text-center text-[10px] text-neutral-400">
            Printed {dateTime(new Date())}
            {r.printCount > 0 && ` · copy ${r.printCount + 1}`}
            {company.invoiceFooter && ` · ${company.invoiceFooter}`}
          </p>
        </div>
      </PrintSheet>
    </>
  )
}
