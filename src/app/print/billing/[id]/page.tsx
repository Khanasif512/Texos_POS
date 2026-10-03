import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintSheet, PrintToolbar } from "@/components/shared/print-toolbar"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { billingProvider } from "@/server/modules/platform/billing"
import { amount, date } from "@/lib/format"
import { BILLING_STATUS_LABELS } from "@/lib/validation/billing"

export const metadata: Metadata = { title: "Billing invoice" }

/** §7: subscription invoice issued by the platform (Texon) to the tenant company. */
export default async function BillingInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/print/billing/${id}`)
  ensurePermission(ctx, "settings.billing")
  const inv = await prisma.billingInvoice.findFirst({ where: { id, companyId: ctx.companyId }, include: { company: true } })
  if (!inv) notFound()
  const checkout =
    inv.status === "unpaid"
      ? await billingProvider(inv.provider).createCheckout({
          id: inv.id,
          number: inv.number,
          amount: inv.amount.toFixed(2),
          currency: inv.currency,
          description: inv.description,
          companyName: inv.company.name,
        })
      : null
  const c = inv.company
  const stamp = inv.status === "paid" ? "PAID" : inv.status === "void" ? "VOID" : inv.status === "failed" ? "PAYMENT FAILED" : null

  return (
    <>
      <PrintToolbar title={`Invoice ${inv.number}`} />
      <PrintSheet>
        <div className="relative">
          {stamp && (
            <div className={`pointer-events-none absolute top-40 right-6 rotate-[-12deg] rounded border-4 border-current px-4 py-1 text-3xl font-black tracking-widest ${inv.status === "paid" ? "text-emerald-600/40" : "text-red-600/40"}`}>
              {stamp}
            </div>
          )}
          <header className="flex items-start justify-between border-b-2 border-neutral-800 pb-4">
            <div>
              <p className="text-xl font-bold">
                Texon<span className="text-indigo-600">POS</span>
              </p>
              <p className="text-xs text-neutral-600">Texon Technologies · Dhaka, Bangladesh</p>
              <p className="text-xs text-neutral-600">billing@texonpos.com</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold tracking-wide">INVOICE</p>
              <table className="mt-1 text-xs">
                <tbody>
                  {[
                    ["Invoice no.", inv.number],
                    ["Issued", date(inv.issuedAt)],
                    ["Due", date(inv.dueAt)],
                    ["Status", BILLING_STATUS_LABELS[inv.status]],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="pr-3 text-neutral-500">{k}</td>
                      <td className="num text-right font-medium">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </header>

          <section className="mt-5 rounded border border-neutral-300 p-3 text-xs">
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Bill to</p>
            <p className="text-sm font-semibold">{c.name}</p>
            {c.address && <p>{c.address}</p>}
            <p>{c.email}</p>
            {c.phone && <p className="num">{c.phone}</p>}
            {c.binNumber && <p className="num">BIN: {c.binNumber}</p>}
          </section>

          <table className="mt-5 w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-neutral-800 bg-neutral-100 text-left">
                <th className="px-2 py-1.5">Description</th>
                <th className="px-2 py-1.5">Service period</th>
                <th className="px-2 py-1.5 text-right">Amount (BDT)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-300">
                <td className="px-2 py-2">{inv.description ?? "TexonPOS subscription"}</td>
                <td className="px-2 py-2">{inv.periodStart ? `${date(inv.periodStart)} – ${date(inv.periodEnd)}` : "—"}</td>
                <td className="num px-2 py-2 text-right">{amount(inv.amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="px-2 pt-3 text-right font-semibold">
                  Total
                </td>
                <td className="num px-2 pt-3 text-right text-sm font-bold">৳ {amount(inv.amount)}</td>
              </tr>
            </tfoot>
          </table>

          {inv.status === "paid" && (
            <p className="mt-6 text-xs">
              Paid on <strong>{date(inv.paidAt)}</strong> via {inv.provider === "manual" ? "bank transfer / bKash" : inv.provider}
              {inv.paymentReference ? ` · reference ${inv.paymentReference}` : ""}. Thank you for your business.
            </p>
          )}
          {checkout?.instructions && (
            <section className="mt-6 rounded border border-neutral-300 p-3 text-xs">
              <p className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">How to pay</p>
              <p className="leading-relaxed whitespace-pre-wrap">{checkout.instructions}</p>
            </section>
          )}
          <p className="mt-10 text-center text-[10px] text-neutral-500">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </PrintSheet>
    </>
  )
}
