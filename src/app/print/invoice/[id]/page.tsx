import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintSheet } from "@/components/shared/print-toolbar"
import { DocPrintToolbar } from "@/components/sales/doc-print-toolbar"
import { Letterhead, Signatures, Watermark } from "@/components/sales/letterhead"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { AppError } from "@/server/errors"
import { amountInWords } from "@/server/modules/sales/calc"
import { getInvoiceDetail, getLetterhead } from "@/server/modules/sales/queries"
import { amount, date, dateTime, quantity } from "@/lib/format"
import { PAYMENT_METHOD_LABEL } from "@/lib/validation/sales"

export const metadata: Metadata = { title: "Invoice" }

/** A4 invoice (SLS-01, SLS-08). Each print is recorded; copies after the first carry a REPRINT mark. */
export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const ctx = await requireTenant(`/print/invoice/${id}`)
  ensurePermission(ctx, "sales.view")
  const inv = await getInvoiceDetail(ctx, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound()
    throw e
  })
  const company = await getLetterhead(ctx.companyId)
  const cancelled = inv.status === "cancelled"
  const lineDiscount = inv.lines.some((l) => l.discount > 0)
  const customerName = inv.customer?.name ?? inv.customerName ?? "Walk-in customer"
  const customerPhone = inv.customer?.phone ?? inv.customerPhone

  return (
    <>
      <DocPrintToolbar title={`Invoice ${inv.number}`} endpoint={`/api/v1/invoices/${inv.id}/print`} auto={sp.auto === "1"} />
      <PrintSheet>
        <div className="relative">
          {cancelled ? <Watermark text="CANCELLED" tone="danger" /> : inv.printCount > 0 && <Watermark text="REPRINT" />}

          <Letterhead
            company={company}
            title={inv.type === "cash" ? "CASH INVOICE" : "CREDIT INVOICE"}
            meta={[
              ["Invoice no.", inv.number],
              ["Date", date(inv.invoiceDate)],
              ["Branch", inv.branch.name],
              ...(inv.printCount > 0 ? ([["Copy", `Reprint #${inv.printCount}`]] as [string, string][]) : []),
            ]}
          />

          <section className="mt-4 grid grid-cols-2 gap-6 text-xs">
            <div className="rounded border border-neutral-300 p-3">
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Bill to</p>
              <p className="text-sm font-semibold">{customerName}</p>
              {inv.customer?.code && <p className="num text-neutral-600">Customer ID: {inv.customer.code}</p>}
              {customerPhone && <p className="num">Phone: {customerPhone}</p>}
              {inv.customer?.address && <p className="text-neutral-700">{inv.customer.address}</p>}
            </div>
            <div className="rounded border border-neutral-300 p-3">
              <table className="w-full">
                <tbody>
                  {[
                    ["Salesman", inv.salesman?.name ?? "—"],
                    ["Payment", inv.paymentMethod ? PAYMENT_METHOD_LABEL[inv.paymentMethod] : inv.type === "credit" ? "On credit" : "—"],
                    ["Printed", dateTime(new Date())],
                    ...(cancelled ? [["Status", "CANCELLED"]] : []),
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
                <th className="px-2 py-1.5">Description</th>
                <th className="px-2 py-1.5 text-right">Qty</th>
                <th className="px-2 py-1.5 text-right">Unit price</th>
                {lineDiscount && <th className="px-2 py-1.5 text-right">Discount</th>}
                <th className="px-2 py-1.5 text-right">Amount (৳)</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={l.id} className="border-b border-neutral-200 align-top break-inside-avoid">
                  <td className="num px-2 py-1.5 text-neutral-500">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <p className="font-medium">{l.productName}</p>
                    <p className="text-[11px] text-neutral-500">
                      {l.variationName} · {l.sku}
                      {l.description && ` · ${l.description}`}
                    </p>
                  </td>
                  <td className="num px-2 py-1.5 text-right whitespace-nowrap">
                    {quantity(l.quantity)} {l.unit}
                  </td>
                  <td className="num px-2 py-1.5 text-right">{amount(l.unitPrice)}</td>
                  {lineDiscount && <td className="num px-2 py-1.5 text-right">{l.discount ? amount(l.discount) : "—"}</td>}
                  <td className="num px-2 py-1.5 text-right font-medium">{amount(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <section className="mt-3 grid grid-cols-[1fr_260px] gap-6 break-inside-avoid">
            <div className="text-xs">
              <p className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Amount in words</p>
              <p className="mt-0.5 font-medium italic">{amountInWords(inv.total)}</p>
              {inv.note && (
                <p className="mt-3 text-neutral-600">
                  <span className="font-medium text-neutral-800">Note:</span> {inv.note}
                </p>
              )}
            </div>
            <table className="text-xs">
              <tbody>
                <Tr label="Subtotal" value={amount(inv.subtotal)} />
                {inv.discount > 0 && <Tr label="Discount" value={`− ${amount(inv.discount)}`} />}
                {inv.tax > 0 && <Tr label="VAT / tax" value={amount(inv.tax)} />}
                {inv.deliveryCharge > 0 && <Tr label="Delivery charge" value={amount(inv.deliveryCharge)} />}
                <tr className="border-y border-neutral-800 text-sm font-bold">
                  <td className="py-1.5">Total (৳)</td>
                  <td className="num py-1.5 text-right">{amount(inv.total)}</td>
                </tr>
                <Tr label="Paid" value={amount(inv.paidAmount)} />
                {inv.returnedAmount > 0 && <Tr label="Returned" value={amount(inv.returnedAmount)} />}
                <tr className="font-semibold">
                  <td className="py-1">Due</td>
                  <td className="num py-1 text-right">{amount(inv.dueAmount)}</td>
                </tr>
                {inv.customer && inv.type === "credit" && <Tr label="Customer balance now" value={amount(inv.customer.balance)} />}
              </tbody>
            </table>
          </section>

          <Signatures left="Customer signature" right="Authorised signature" />

          <footer className="mt-8 border-t border-neutral-300 pt-2 text-center text-[10px] text-neutral-500">
            {company.invoiceFooter && <p className="mb-1 whitespace-pre-line text-neutral-700">{company.invoiceFooter}</p>}
            <p>Goods once sold are subject to the return policy. This is a computer-generated invoice — powered by TexonPOS.</p>
          </footer>
        </div>
      </PrintSheet>
    </>
  )
}

function Tr({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-0.5 text-neutral-600">{label}</td>
      <td className="num py-0.5 text-right">{value}</td>
    </tr>
  )
}
