import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintSheet } from "@/components/shared/print-toolbar"
import { DocPrintToolbar } from "@/components/sales/doc-print-toolbar"
import { Letterhead, Watermark } from "@/components/sales/letterhead"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { getChallanDetail, getLetterhead } from "@/server/modules/sales/queries"
import { amount, date, quantity } from "@/lib/format"

export const metadata: Metadata = { title: "Delivery challan" }

/** A4 delivery challan (SLS-03, DLV-02): items and quantities; prices only when the challan says so. */
export default async function ChallanPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const ctx = await requireTenant(`/print/challan/${id}`)
  ensurePermission(ctx, "delivery.view", "sales.view")
  const ch = await getChallanDetail(ctx, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const company = await getLetterhead(ctx.companyId)
  const cancelled = ch.invoice.status === "cancelled"
  const totalQty = ch.lines.reduce((a, l) => a + l.quantity, 0)

  return (
    <>
      <DocPrintToolbar title={`Challan ${ch.number}`} endpoint={`/api/v1/challans/${ch.id}/print`} auto={sp.auto === "1"} />
      <PrintSheet>
        <div className="relative">
          {cancelled ? <Watermark text="CANCELLED" tone="danger" /> : ch.printCount > 0 && <Watermark text="REPRINT" />}
          <Letterhead
            company={company}
            title="DELIVERY CHALLAN"
            meta={[
              ["Challan no.", ch.number],
              ["Date", date(ch.createdAt)],
              ["Invoice no.", ch.invoice.number],
              ["Invoice date", date(ch.invoice.invoiceDate)],
              ...(ch.printCount > 0 ? ([["Copy", `Reprint #${ch.printCount}`]] as [string, string][]) : []),
            ]}
          />

          <section className="mt-4 grid grid-cols-2 gap-6 text-xs">
            <div className="rounded border border-neutral-300 p-3">
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Deliver to</p>
              <p className="text-sm font-semibold">{ch.invoice.customerName ?? "Walk-in customer"}</p>
              {ch.invoice.customerCode && <p className="num text-neutral-600">Customer ID: {ch.invoice.customerCode}</p>}
              {ch.invoice.customerPhone && <p className="num">Phone: {ch.invoice.customerPhone}</p>}
              <p className="mt-1 text-neutral-700">{ch.deliveryAddress ?? "Address: ______________________________"}</p>
            </div>
            <div className="rounded border border-neutral-300 p-3">
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Delivery</p>
              <table className="w-full">
                <tbody>
                  {[
                    ["From", ch.branch ? `${ch.branch.name}` : "—"],
                    ["Delivery person", ch.deliveryPerson ?? "________________"],
                    ["Phone", ch.deliveryPhone ?? "________________"],
                    ["Vehicle no.", ch.vehicleNo ?? "________________"],
                    ["Delivery date", ch.deliveryDate ? date(ch.deliveryDate) : "________________"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="py-0.5 pr-2 text-neutral-500">{k}</td>
                      <td className="py-0.5 text-right font-medium">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <table className="mt-4 w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-neutral-800 bg-neutral-100 text-left">
                <th className="w-8 px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">SKU</th>
                <th className="px-2 py-1.5 text-right">Quantity</th>
                {ch.showPrices && <th className="px-2 py-1.5 text-right">Unit price</th>}
                {ch.showPrices && <th className="px-2 py-1.5 text-right">Amount (৳)</th>}
                <th className="w-24 px-2 py-1.5 text-center">Received ✓</th>
              </tr>
            </thead>
            <tbody>
              {ch.lines.map((l, i) => (
                <tr key={l.id} className="border-b border-neutral-200 align-top break-inside-avoid">
                  <td className="num px-2 py-2 text-neutral-500">{i + 1}</td>
                  <td className="px-2 py-2">
                    <p className="font-medium">{l.productName}</p>
                    <p className="text-[11px] text-neutral-500">
                      {l.variationName}
                      {l.description && ` · ${l.description}`}
                    </p>
                  </td>
                  <td className="num px-2 py-2 text-neutral-600">{l.sku}</td>
                  <td className="num px-2 py-2 text-right font-semibold whitespace-nowrap">
                    {quantity(l.quantity)} {l.unit}
                  </td>
                  {ch.showPrices && <td className="num px-2 py-2 text-right">{amount(l.unitPrice)}</td>}
                  {ch.showPrices && <td className="num px-2 py-2 text-right">{amount(l.lineTotal)}</td>}
                  <td className="px-2 py-2 text-center text-neutral-400">☐</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-800 font-semibold">
                <td className="px-2 py-1.5" colSpan={3}>
                  {ch.lines.length} item{ch.lines.length === 1 ? "" : "s"}
                </td>
                <td className="num px-2 py-1.5 text-right">{quantity(totalQty)}</td>
                {ch.showPrices && <td />}
                {ch.showPrices && <td className="num px-2 py-1.5 text-right">{amount(ch.invoice.total)}</td>}
                <td />
              </tr>
            </tfoot>
          </table>

          {ch.note && (
            <p className="mt-3 text-xs text-neutral-700">
              <span className="font-medium">Note:</span> {ch.note}
            </p>
          )}
          <p className="mt-4 text-xs text-neutral-600">Received the above goods in good condition and correct quantity.</p>

          <div className="mt-14 grid grid-cols-3 gap-10 text-xs break-inside-avoid">
            <div className="border-t border-neutral-500 pt-1.5 text-center text-neutral-600">Prepared by</div>
            <div className="border-t border-neutral-500 pt-1.5 text-center text-neutral-600">Delivered by</div>
            <div className="border-t border-neutral-500 pt-1.5 text-center text-neutral-600">Receiver signature &amp; date</div>
          </div>
          <footer className="mt-8 border-t border-neutral-300 pt-2 text-center text-[10px] text-neutral-500">
            This challan is not a bill. Computer-generated by TexonPOS.
          </footer>
        </div>
      </PrintSheet>
    </>
  )
}
