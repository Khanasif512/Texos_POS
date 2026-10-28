import type { Metadata } from "next"
import Link from "next/link"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { ProductForm } from "@/components/products/product-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { listProductBrands } from "@/server/modules/products/service"
import { Gauge } from "lucide-react"

export const metadata: Metadata = { title: "New product" }

export default async function NewProductPage() {
  const ctx = await requireTenant("/app/products/new")
  ensurePermission(ctx, "inventory.create")
  const db = tenantDb(ctx.companyId)
  const [categories, brands, count] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, parentId: true } }),
    listProductBrands(db),
    db.product.count(),
  ])
  const atLimit = ctx.plan.maxProducts != null && count >= ctx.plan.maxProducts
  return (
    <PageBody>
      <PageHeader back={{ href: "/app/products", label: "Products" }} title="New product" description="Add the product once, then one row per size, thickness or colour." />
      {atLimit ? (
        <EmptyState
          icon={Gauge}
          title="Product limit reached"
          text={`Your ${ctx.plan.name} plan allows ${ctx.plan.maxProducts} products. Upgrade to add more.`}
          action={
            <Button asChild>
              <Link href="/app/settings/billing">View plans</Link>
            </Button>
          }
        />
      ) : (
        <ProductForm categories={categories} brands={brands} />
      )}
    </PageBody>
  )
}
