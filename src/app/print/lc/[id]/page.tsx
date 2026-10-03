import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { PrintSheet, PrintToolbar } from "@/components/shared/print-toolbar"
import { foreign, kg, percent, rate, unitMoney } from "@/components/lc/lc-format"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma, tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getLcDetail, getSnapshot } from "@/server/modules/lc/service"
import { date, dateTime, money, quantity } from "@/lib/format"
import { BASIS_LABEL, LC_COST_TYPE_LABEL, LC_COST_TYPES, LC_STATUS_LABEL } from "@/lib/validation/lc"

export const metadata: Metadata = { title: "LC cost sheet" }

/** LC cost & landed-cost sheet (LC-06 calculation trail, printable). */
export default async function LcPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/print/lc/${id}`)
  ensurePermission(ctx, "lc.view")
  if (!ctx.plan.features.lc) redirect(`/app/lc`)
  const db = tenantDb(ctx.companyId)
  const lc = await getLcDetail(ctx, db, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  if (!lc.showCost) redirect("/app/forbidden")
  const company = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { name: true, address: true, phone: true, email: true, binNumber: true },
  })
  const current = lc.snapshots.find((s) => s.isCurrent) ?? null
  const snap = current ? await getSnapshot(ctx, db, lc.id, current.id) : null
  const preview = lc.preview?.[lc.distributionBasis]
  const meta = new Map(lc.lines.map((l) => [l.id, l]))

  const rows = snap
    ? snap.lines.map((l) => ({ ...l, meta: meta.get(l.lcLineId) }))
    : preview?.ok
      ? preview.result.lines.map((l) => ({ ...l, id: l.lcLineId, unitWeight: meta.get(l.lcLineId)?.unitWeight ?? 0, meta: meta.get(l.lcLineId) }))
      : []
  const basis = snap?.basis ?? lc.distributionBasis
  const exRate = snap?.exchangeRate ?? lc.exchangeRate
  const items = snap
    ? snap.costItems.map((c) => ({ id: c.id, costType: c.costType, description: c.description, entryDate: c.entryDate, amount: c.amount }))
    : lc.costItems
  const extra = snap?.totalExtraCost ?? lc.totals.extraCost
  const base = snap?.totalBaseCost ?? lc.totals.baseCost
  const ordered = [...items].sort(
    (a, b) => LC_COST_TYPES.indexOf(a.costType as (typeof LC_COST_TYPES)[number]) - LC_COST_TYPES.indexOf(b.costType as (typeof LC_COST_TYPES)[number]),
  )

  return (
    <>
      <PrintToolbar title={`LC ${lc.lcNumber} — cost sheet`} />
      <PrintSheet>
        <header className="flex items-start justify-between border-b-2 border-neutral-800 pb-3">
          <div>
            <h1 className="text-xl font-bold">{company?.name}</h1>
            {company?.address && <p className="text-xs text-neutral-600">{company.address}</p>}
            <p className="text-xs text-neutral-600">
              {[company?.phone, company?.email, company?.binNumber && `BIN ${company.binNumber}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold tracking-wide uppercase">LC cost &amp; landed cost sheet</p>
            <p className="num text-sm">{lc.lcNumber}</p>
            <p className="text-xs text-neutral-600">Status: {LC_STATUS_LABEL[lc.status]}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
          {[
            ["Supplier", lc.supplier.name],
            ["Issuing bank", lc.issuingBank],
            ["Receiving branch", lc.branch.name],
            ["LC value", foreign(lc.lcValue, lc.currency)],
            ["Exchange rate", exRate > 0 ? `1 ${lc.currency} = ${rate(exRate)} BDT` : "—"],
            ["Distribution basis", BASIS_LABEL[basis]],
            ["Opened", date(lc.openedDate)],
            ["Arrived", date(lc.actualArrivalDate)],
            ["Calculation", snap ? `v${snap.version} · ${dateTime(snap.createdAt)}` : "Preview (not saved)"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-neutral-500">{k}</p>
              <p className="font-medium">{v}</p>
            </div>
          ))}
        </section>

        <h2 className="mt-5 mb-1.5 text-sm font-semibold">Cost items (BDT)</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-neutral-400 bg-neutral-100">
              <th className="px-2 py-1 text-left">Cost type</th>
              <th className="px-2 py-1 text-left">Description</th>
              <th className="px-2 py-1 text-left">Date</th>
              <th className="px-2 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200 italic">
              <td className="px-2 py-1">Product purchase value (base)</td>
              <td className="px-2 py-1">
                {foreign(lc.totals.valueForeign, lc.currency)} × {rate(exRate)}
              </td>
              <td />
              <td className="num px-2 py-1 text-right">{money(base)}</td>
            </tr>
            {ordered.map((c) => (
              <tr key={c.id} className="border-b border-neutral-200">
                <td className="px-2 py-1">{LC_COST_TYPE_LABEL[c.costType as keyof typeof LC_COST_TYPE_LABEL] ?? c.costType}</td>
                <td className="px-2 py-1">{c.description ?? ""}</td>
                <td className="px-2 py-1">{date(c.entryDate)}</td>
                <td className="num px-2 py-1 text-right">{money(c.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-400 font-semibold">
              <td className="px-2 py-1" colSpan={3}>
                Total extra cost
              </td>
              <td className="num px-2 py-1 text-right">{money(extra)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="px-2 py-1" colSpan={3}>
                Total landed cost (base + extra)
              </td>
              <td className="num px-2 py-1 text-right">{money(base + extra)}</td>
            </tr>
          </tfoot>
        </table>

        <h2 className="mt-5 mb-1.5 text-sm font-semibold">Landed cost per product — {BASIS_LABEL[basis].toLowerCase()}</h2>
        {rows.length === 0 ? (
          <p className="text-xs text-neutral-600">Landed cost cannot be calculated yet{preview && !preview.ok ? `: ${preview.error}` : "."}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-neutral-400 bg-neutral-100">
                <th className="px-2 py-1 text-left">Product</th>
                <th className="px-2 py-1 text-right">Qty</th>
                <th className="px-2 py-1 text-right">Weight</th>
                <th className="px-2 py-1 text-right">Share</th>
                <th className="px-2 py-1 text-right">Base/unit</th>
                <th className="px-2 py-1 text-right">Extra total</th>
                <th className="px-2 py-1 text-right">Extra/unit</th>
                <th className="px-2 py-1 text-right">Landed/unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-200">
                  <td className="px-2 py-1">
                    {r.meta?.productName} — {r.meta?.variationName}
                    <span className="block text-[10px] text-neutral-500">{r.meta?.sku}</span>
                  </td>
                  <td className="num px-2 py-1 text-right">{quantity(r.quantity)}</td>
                  <td className="num px-2 py-1 text-right">{kg(r.quantity * r.unitWeight)}</td>
                  <td className="num px-2 py-1 text-right">{percent(r.ratio)}</td>
                  <td className="num px-2 py-1 text-right">{unitMoney(r.baseUnitCost)}</td>
                  <td className="num px-2 py-1 text-right">{money(r.extraCostTotal)}</td>
                  <td className="num px-2 py-1 text-right">{unitMoney(r.extraUnitCost)}</td>
                  <td className="num px-2 py-1 text-right font-semibold">{unitMoney(r.landedUnitCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-400 font-semibold">
                <td className="px-2 py-1" colSpan={5}>
                  Distributed extra cost
                </td>
                <td className="num px-2 py-1 text-right">{money(rows.reduce((a, r) => a + Math.round(r.extraCostTotal * 100), 0) / 100)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
        <p className="mt-2 text-[10px] text-neutral-500">
          Landed unit cost = unit price × exchange rate + share of extra cost per unit. Extra cost is distributed by{" "}
          {basis === "weight" ? "unit weight × quantity" : "quantity"}; rounding differences are placed on the largest line so totals match exactly.
          {snap?.reason && ` Calculation note: ${snap.reason}.`}
        </p>

        <footer className="mt-16 grid grid-cols-3 gap-8 text-center text-xs">
          {["Prepared by", "Checked by (Accounts)", "Approved by"].map((s) => (
            <div key={s} className="border-t border-neutral-500 pt-1">
              {s}
            </div>
          ))}
        </footer>
        <p className="mt-6 text-center text-[10px] text-neutral-400">Printed {dateTime(new Date())} by {ctx.name} · TexonPOS</p>
      </PrintSheet>
    </>
  )
}
