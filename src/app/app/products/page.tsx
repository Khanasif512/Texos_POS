import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { ProductsTable } from "@/components/products/products-table"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listProducts, PRODUCT_SORTABLE } from "@/server/modules/products/service"

export const metadata: Metadata = { title: "Products" }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/products")
  ensurePermission(ctx, "inventory.view")
  const db = tenantDb(ctx.companyId)
  const p = readListParams(await searchParams, { sortable: PRODUCT_SORTABLE, defaultSort: "name:asc" })
  const categoryId = p.get("categoryId")
  const [{ rows, total }, categories, count] = await Promise.all([
    listProducts(ctx, db, { q: p.q, categoryId, status: p.status, branchId: p.branchId, skip: p.skip, take: p.take, orderBy: p.orderBy }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.count(),
  ])
  const limitText = ctx.plan.maxProducts != null ? ` ${count} of ${ctx.plan.maxProducts.toLocaleString("en-IN")} products used on the ${ctx.plan.name} plan.` : ""
  return (
    <PageBody>
      <PageHeader title="Products" description={`Every variation keeps its own price and stock.${limitText}`} />
      <ProductsTable
        rows={rows}
        total={total}
        page={p.page}
        limit={p.limit}
        categories={categories}
        filtered={!!(p.q || p.status || categoryId)}
      />
    </PageBody>
  )
}
