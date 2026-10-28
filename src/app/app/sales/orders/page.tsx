import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { OrdersTable } from "@/components/sales-after/tables"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listOrders } from "@/server/modules/sales-after/queries"

export const metadata: Metadata = { title: "Quotations & orders" }

export default async function OrdersPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/sales/orders")
  ensurePermission(ctx, "sales.view", "sales.create")
  const p = readListParams(await searchParams, { sortable: ["date", "number", "total", "createdAt"], defaultSort: "date:desc" })
  const r = await listOrders(ctx, tenantDb(ctx.companyId), p)
  return (
    <PageBody>
      <PageHeader title="Quotations & orders" description="Price quotes and confirmed orders before they are invoiced. Convert at the POS, or cancel (SLS-07)." />
      <OrdersTable rows={r.rows} total={r.total} page={p.page} limit={p.limit} />
    </PageBody>
  )
}