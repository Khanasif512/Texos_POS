import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { CustomersTable } from "@/components/customers/customers-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { CUSTOMER_SORTABLE, listCustomers } from "@/server/modules/customers/service"
import { money } from "@/lib/format"

export const metadata: Metadata = { title: "Customers" }

export default async function CustomersPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/customers")
  ensurePermission(ctx, "customers.view")
  const db = tenantDb(ctx.companyId)
  const p = readListParams(await searchParams, { sortable: CUSTOMER_SORTABLE, defaultSort: "name:asc" })
  const type = p.get("type")
  const [{ rows, total }, receivable] = await Promise.all([
    listCustomers(db, { q: p.q, type, status: p.status, skip: p.skip, take: p.take, orderBy: p.orderBy }),
    db.customer.aggregate({ where: { balance: { gt: 0 } }, _sum: { balance: true }, _count: true }),
  ])
  return (
    <PageBody>
      <PageHeader
        title="Customers"
        description={
          receivable._count
            ? `${receivable._count} customer(s) owe you ${money(receivable._sum.balance?.toString() ?? 0)} in total.`
            : "Retail buyers, wholesalers and dealers with their credit limits and outstanding dues."
        }
      />
      <CustomersTable rows={rows} total={total} page={p.page} limit={p.limit} filtered={!!(p.q || p.status || type)} />
    </PageBody>
  )
}
