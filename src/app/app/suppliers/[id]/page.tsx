import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BookOpen, FileText, Landmark, Mail, MapPin, Phone, Ship, User } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { LedgerTable } from "@/components/suppliers/ledger-table"
import { SupplierActions } from "@/components/suppliers/supplier-actions"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getSupplierDetail } from "@/server/modules/suppliers/service"
import { date, money } from "@/lib/format"

export const metadata: Metadata = { title: "Supplier" }

const LC_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "primary"> = {
  draft: "neutral",
  opened: "info",
  goods_in_transit: "warning",
  received: "primary",
  cost_finalized: "success",
  closed: "neutral",
}
const PO_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "info",
  partially_received: "warning",
  received: "success",
  cancelled: "danger",
}
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/suppliers/${id}`)
  ensurePermission(ctx, "suppliers.view")
  const detail = await getSupplierDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const { supplier: s, stats } = detail
  const contact = [
    { icon: User, value: s.contactPerson },
    { icon: Phone, value: s.phone },
    { icon: Mail, value: s.email },
    { icon: MapPin, value: s.address },
  ].filter((c) => c.value)

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/suppliers", label: "Suppliers" }}
        title={
          <span className="flex items-center gap-2">
            {s.name}
            <ActiveBadge status={s.status} />
          </span>
        }
        description={`${s.code} · ${s.country ?? "Country not set"} · pays in ${s.currency}`}
        actions={<SupplierActions supplier={s} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total purchases" value={money(stats.totalPurchases)} hint="LC and purchase value posted to the ledger" />
        <StatCard label="Total paid" value={money(stats.totalPaid)} hint="Payments and adjustments" />
        <StatCard
          label="Outstanding payable"
          value={money(Math.abs(stats.outstanding))}
          tone={stats.outstanding > 0 ? "danger" : stats.outstanding < 0 ? "success" : "default"}
          hint={stats.outstanding < 0 ? "Advance paid to supplier" : `Opening balance ${money(s.openingBalance)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="h-fit rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Profile</h2>
          </div>
          <div className="space-y-4 p-5 text-sm">
            {contact.length ? (
              <ul className="space-y-2.5">
                {contact.map((c, i) => (
                  <li key={i} className="flex gap-2.5">
                    <c.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="break-words whitespace-pre-line">{c.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No contact details yet.</p>
            )}
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Landmark className="size-3.5" /> Bank details for LC
              </p>
              {s.bankDetails ? (
                <pre className="rounded-lg bg-muted/60 p-3 font-mono text-xs break-words whitespace-pre-wrap">{s.bankDetails}</pre>
              ) : (
                <p className="text-muted-foreground">Not provided</p>
              )}
            </div>
            {s.notes && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                <p className="whitespace-pre-line">{s.notes}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Added {date(s.createdAt)}</p>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Supplier ledger</h2>
              <p className="text-xs text-muted-foreground">Credit = payable increased · Debit = paid / reduced</p>
            </div>
          </div>
          {detail.ledger.length ? (
            <LedgerTable rows={detail.ledger} total={detail.ledgerCount} debitLabel="Debit (paid)" creditLabel="Credit (payable)" />
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No ledger entries yet"
              text="LC values, purchases and payments for this supplier will be posted here."
              className="m-5"
            />
          )}
        </section>
      </div>

      {(detail.lcs || detail.purchaseOrders) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {detail.lcs && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-5 py-4">
                <Ship className="size-4 text-muted-foreground" />
                <h2 className="font-semibold">Letters of credit</h2>
                <span className="text-xs text-muted-foreground">({detail.lcs.length})</span>
              </div>
              {detail.lcs.length ? (
                <ul className="divide-y">
                  {detail.lcs.map((l) => (
                    <li key={l.id}>
                      <Link href={`/app/lc/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="num truncate text-sm font-medium">{l.lcNumber}</p>
                          <p className="text-xs text-muted-foreground">{l.openedDate ? `Opened ${date(l.openedDate)}` : "Not opened yet"}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="num text-sm">
                            {l.currency} {l.lcValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </span>
                          <StatusBadge tone={LC_TONE[l.status] ?? "neutral"}>{label(l.status)}</StatusBadge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No LCs opened with this supplier.</p>
              )}
            </section>
          )}
          {detail.purchaseOrders && (
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-5 py-4">
                <FileText className="size-4 text-muted-foreground" />
                <h2 className="font-semibold">Purchase orders</h2>
                <span className="text-xs text-muted-foreground">({detail.purchaseOrders.length})</span>
              </div>
              {detail.purchaseOrders.length ? (
                <ul className="divide-y">
                  {detail.purchaseOrders.map((p) => (
                    <li key={p.id}>
                      <Link href={`/app/purchases/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="num truncate text-sm font-medium">{p.number}</p>
                          <p className="text-xs text-muted-foreground">{date(p.orderDate)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="num text-sm">{money(p.totalBdt)}</span>
                          <StatusBadge tone={PO_TONE[p.status] ?? "neutral"}>{label(p.status)}</StatusBadge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No purchase orders for this supplier.</p>
              )}
            </section>
          )}
        </div>
      )}
    </PageBody>
  )
}
