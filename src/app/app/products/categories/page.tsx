import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { CategoriesClient } from "@/components/products/categories-client"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { listCategories } from "@/server/modules/products/service"

export const metadata: Metadata = { title: "Product categories" }

export default async function CategoriesPage() {
  const ctx = await requireTenant("/app/products/categories")
  ensurePermission(ctx, "inventory.view")
  const rows = await listCategories(tenantDb(ctx.companyId))
  return (
    <PageBody className="max-w-4xl">
      <PageHeader
        back={{ href: "/app/products", label: "Products" }}
        title="Categories"
        description="Group products for search, filters and stock reports."
      />
      <CategoriesClient rows={rows} />
    </PageBody>
  )
}
