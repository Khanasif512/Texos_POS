import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintSheet, PrintToolbar } from "@/components/shared/print-toolbar"
import { Letterhead, Signatures, Watermark } from "@/components/sales/letterhead"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { amountInWords } from "@/server/modules/sales-after/calc"
import { getOrder } from "@/server/modules/sales-after/orders"
import { getLetterhead } from "@/server/modules/sales/queries"
import { amount, date, dateTime, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Quotation" }

/** Printable quotation / sales order (SLS-07). */
export default async function QuotationPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const ctx = await requireTenant(`/print/quotation/${id}`)
  ensurePermission(ctx, "sales.view", "sales.create")
  const o = await getOrder(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const company = await getLetterhead(ctx.companyId)
  const isOrder = o.type === "order"
  const hasDiscount = o.lines.some((l) => l.discount > 0)

  return (
    <>
      <PrintToolbar title={`${isOrder ? "Sales order" : "Quotation"} ${o.number}`} auto={sp.auto === "1"} />
      <PrintSheet>
        <div className="relative">
          {o.status === "cancelled" && <Watermark text="CANCELLED" tone="danger" />}
          <Letterhead
            company={company}
            title={isOrder ? "SALES ORDER" : "QUOTATION"}
            meta={[
              [isOrder ? "Order no." : "Quotation no.", o.number],
              ["Date", date(o.date)],
              ...(o.validUntil ? ([[isOrder ? "Delivery by" : "Valid until", date(o.validUntil)]] as [string, string][]) : []),
            ]}
          />

          <div className="mt-5 text-xs">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">{isOrder ? "Customer" : "Prepared for"}</p>
            {o.customer ? (
              <>
                <p className="mt-1 text-sm font-semibold">{o.customer.name}</p>
                {o.customer.phone && <p>{o.customer.phone}</p>}
                {o.customer.address && <p className="text-neutral-600">{o.customer.address}</p>}
              </>
            ) : (
              <p className="mt-1 text-sm">Valued customer</p>
            )}
          </div>

          <table className="mt-5 w-full text-xs">
            <thead>
              <tr className="border-y border-neutral-800 text-left">
                <th className="py-1.5 pr-2 font-semibold">#</th>
                <th className="py-1.5 pr-2 font-semibold">Item</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Qty</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Unit price</th>
                {hasDiscount && <th className="py-1.5 pr-2 text-right font-semibold">Discount</th>}
                <th className="py-1.5 text-right font-semibold">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l, i) => (
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
                  {hasDiscount && <td className="num py-1.5 pr-2 text-right">{l.discount ? amount(l.discount) : "—"}</td>}
                  <td className="num py-1.5 text-right">{amount(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex justify-end">
            <table className="w-64 text-xs">
              <tbody>
                <tr>
                  <td className="py-0.5 text-neutral-600">Subtotal</td>
                  <td className="num py-0.5 text-right">{amount(o.subtotal)}</td>
                </tr>
                {o.discount > 0 && (
                  <tr>
                    <td className="py-0.5 text-neutral-600">Discount</td>
                    <td className="num py-0.5 text-right">− {amount(o.discount)}</td>
                  </tr>
                )}
                <tr className="border-t border-neutral-800">
                  <td className="py-1.5 font-semibold">Total</td>
                  <td className="num py-1.5 text-right text-sm font-bold">৳ {amount(o.total)}</td>
                </tr>
                {o.advanceAmount > 0 && (
                  <>
                    <tr>
                      <td className="py-0.5 text-neutral-600">Advance received</td>
                      <td className="num py-0.5 text-right">{amount(o.advanceAmount)}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-medium">Balance</td>
                      <td className="num py-0.5 text-right font-medium">{amount(Math.max(o.total - o.advanceAmount, 0))}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs">
            <span className="text-neutral-500">In words: </span>
            <span className="italic">{amountInWords(o.total)}</span>
          </p>

          {o.note && (
            <div className="mt-4 text-xs">
              <p className="font-semibold">{isOrder ? "Notes" : "Terms & notes"}</p>
              <p className="mt-0.5 whitespace-pre-line text-neutral-700">{o.note}</p>
            </div>
          )}
          {!isOrder && (
            <p className="mt-3 text-[11px] text-neutral-500">
              Prices are valid{o.validUntil ? ` until ${date(o.validUntil)}` : " for 15 days"} and subject to stock availability at the time of order.
            </p>
          )}

          <Signatures left={isOrder ? "Customer's signature" : "Accepted by (customer)"} right={`For ${company.name}${o.createdBy ? ` (${o.createdBy})` : ""}`} />
          <p className="mt-6 text-center text-[10px] text-neutral-400">
            Printed {dateTime(new Date())}
            {company.invoiceFooter && ` · ${company.invoiceFooter}`}
          </p>
        </div>
      </PrintSheet>
    </>
  )
}
