import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BookOpen, Building2, Mail, MapPin, Package, Phone, Receipt } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { LedgerTable } from "@/components/suppliers/ledger-table"
import { CustomerActions } from "@/components/customers/customer-actions"
import { CustomerBalance } from "@/components/customers/balance"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getCustomerDetail } from "@/server/modules/customers/service"
import { date, money, quantity } from "@/lib/format"
import { availableCredit, balanceState, CUSTOMER_TYPE_LABELS, type CustomerType } from "@/lib/validation/customers"

export const metadata: Metadata = { title: "Customer" }

const INV_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  confirmed: "success",
  partially_returned: "warning",
  returned: "warning",
  cancelled: "danger",
}
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/customers/${id}`)
  ensurePermission(ctx, "customers.view")
  const d = await getCustomerDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const c = d.customer
  const bal = balanceState(d.stats.outstanding)
  const avail = availableCredit(d.stats.creditLimit, d.stats.outstanding)
  const contact = [
    { icon: Phone, value: c.phone },
    { icon: Mail, value: c.email },
    { icon: MapPin, value: c.address },
    { icon: Building2, value: c.branchName ? `Home branch: ${c.branchName}` : null },
  ].filter((x) => x.value)

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/customers", label: "Customers" }}
        title={
          <span className="flex items-center gap-2">
            {c.name}
            <ActiveBadge status={c.status} />
          </span>
        }
        description={`${c.code} · ${CUSTOMER_TYPE_LABELS[c.type as CustomerType] ?? c.type} customer · since ${date(c.createdAt)}`}
        actions={<CustomerActions customer={c} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={bal.kind === "advance" ? "Advance balance" : "Outstanding"}
          value={money(bal.amount)}
          tone={bal.kind === "due" ? "danger" : bal.kind === "advance" ? "success" : "default"}
          hint={bal.kind === "advance" ? "Will be applied to future credit invoices" : bal.kind === "due" ? "Customer owes you" : "Fully settled"}
        />
        <StatCard label="Credit limit" value={d.stats.creditLimit ? money(d.stats.creditLimit) : "Cash only"} hint="Maximum outstanding on credit" />
        <StatCard
          label="Available credit"
          value={money(avail)}
          tone={d.stats.creditLimit > 0 && avail <= 0 ? "warning" : "default"}
          hint={d.stats.creditLimit > 0 && avail <= 0 ? "Limit reached — credit sales need an override" : "Limit minus outstanding"}
        />
        <StatCard label="Total purchases" value={money(d.stats.totalPurchases)} hint={`${d.stats.invoiceCount} invoice(s), net of returns`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <section className="h-fit rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Profile</h2>
          </div>
          <div className="space-y-4 p-5 text-sm">
            {contact.length ? (
              <ul className="space-y-2.5">
                {contact.map((x, i) => (
                  <li key={i} className="flex gap-2.5">
                    <x.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="break-words whitespace-pre-line">{x.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No contact details yet.</p>
            )}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">Opening balance</span>
              <CustomerBalance value={c.openingBalance} className="text-sm" />
            </div>
            {c.notes && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                <p className="whitespace-pre-line">{c.notes}</p>
              </div>
            )}
          </div>
        </section>

        <Tabs defaultValue="ledger" className="min-w-0">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            <TabsTrigger value="ledger">
              <BookOpen /> Ledger
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt /> Invoices ({d.invoices.length})
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package /> Products ({d.products.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="overflow-hidden rounded-xl border bg-card">
            {d.ledger.length ? (
              <LedgerTable rows={d.ledger} total={d.ledgerCount} debitLabel="Debit (owes)" creditLabel="Credit (paid)" />
            ) : (
              <EmptyState icon={BookOpen} title="No ledger entries yet" text="Invoices, payments and returns will be posted here." className="m-5" />
            )}
          </TabsContent>

          <TabsContent value="invoices" className="overflow-hidden rounded-xl border bg-card">
            {d.invoices.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="h-10 text-xs">Invoice</TableHead>
                      <TableHead className="h-10 text-xs">Date</TableHead>
                      <TableHead className="h-10 text-xs">Type</TableHead>
                      <TableHead className="h-10 text-right text-xs">Total</TableHead>
                      <TableHead className="h-10 text-right text-xs">Paid</TableHead>
                      <TableHead className="h-10 text-right text-xs">Due</TableHead>
                      <TableHead className="h-10 text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.invoices.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="py-2.5">
                          <Link href={`/app/sales/invoices/${i.id}`} className="num font-medium text-primary hover:underline">
                            {i.number}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs whitespace-nowrap text-muted-foreground">{date(i.date)}</TableCell>
                        <TableCell className="py-2.5 capitalize">{i.type}</TableCell>
                        <TableCell className="num py-2.5 text-right">{money(i.total)}</TableCell>
                        <TableCell className="num py-2.5 text-right">{money(i.paid)}</TableCell>
                        <TableCell className={`num py-2.5 text-right ${i.due > 0 ? "text-destructive" : "text-muted-foreground"}`}>{money(i.due)}</TableCell>
                        <TableCell className="py-2.5">
                          <StatusBadge tone={INV_TONE[i.status] ?? "neutral"}>{label(i.status)}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState icon={Receipt} title="No invoices yet" text="Sales to this customer from your branches will appear here." className="m-5" />
            )}
          </TabsContent>

          <TabsContent value="products" className="overflow-hidden rounded-xl border bg-card">
            {d.products.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="h-10 text-xs">Product</TableHead>
                      <TableHead className="h-10 text-right text-xs">Qty bought</TableHead>
                      <TableHead className="h-10 text-right text-xs">Returned</TableHead>
                      <TableHead className="h-10 text-right text-xs">Amount</TableHead>
                      <TableHead className="h-10 text-right text-xs">Invoices</TableHead>
                      <TableHead className="h-10 text-xs">Last purchase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.products.map((p) => (
                      <TableRow key={p.variationId}>
                        <TableCell className="py-2.5">
                          {p.productId ? (
                            <Link href={`/app/products/${p.productId}`} className="font-medium hover:underline">
                              {p.productName}
                            </Link>
                          ) : (
                            <span className="font-medium">{p.productName}</span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {p.variationName} · <span className="num">{p.sku}</span>
                          </p>
                        </TableCell>
                        <TableCell className="num py-2.5 text-right whitespace-nowrap">
                          {quantity(p.quantity)} <span className="text-xs text-muted-foreground">{p.unit}</span>
                        </TableCell>
                        <TableCell className="num py-2.5 text-right text-muted-foreground">{p.returnedQty ? quantity(p.returnedQty) : "—"}</TableCell>
                        <TableCell className="num py-2.5 text-right">{money(p.amount)}</TableCell>
                        <TableCell className="num py-2.5 text-right">{p.invoices}</TableCell>
                        <TableCell className="py-2.5 text-xs whitespace-nowrap text-muted-foreground">{date(p.lastPurchase)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="No purchases yet"
                text="A product-wise summary of what this customer buys will build up as you invoice them."
                className="m-5"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageBody>
  )
}
