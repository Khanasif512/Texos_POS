import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { SuppliersTable } from "@/components/suppliers/suppliers-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listSuppliers, SUPPLIER_SORTABLE } from "@/server/modules/suppliers/service"

export const metadata: Metadata = { title: "Suppliers" }

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/suppliers")
  ensurePermission(ctx, "suppliers.view")
  const p = readListParams(await searchParams, { sortable: SUPPLIER_SORTABLE, defaultSort: "name:asc" })
  const currency = p.get("currency")
  const { rows, total } = await listSuppliers(tenantDb(ctx.companyId), {
    q: p.q,
    status: p.status,
    currency,
    skip: p.skip,
    take: p.take,
    orderBy: p.orderBy,
  })
  return (
    <PageBody>
      <PageHeader title="Suppliers" description="Factories and traders you buy from, with purchase value and what you still owe them." />
      <SuppliersTable rows={rows} total={total} page={p.page} limit={p.limit} filtered={!!(p.q || p.status || currency)} />
    </PageBody>
  )
}
