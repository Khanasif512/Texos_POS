import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { ProductForm } from "@/components/products/product-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getProductForEdit, listProductBrands } from "@/server/modules/products/service"

export const metadata: Metadata = { title: "Edit product" }

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/products/${id}/edit`)
  ensurePermission(ctx, "inventory.update")
  const db = tenantDb(ctx.companyId)
  const [data, categories, brands] = await Promise.all([
    getProductForEdit(ctx, db, id).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
      throw e
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, parentId: true } }),
    listProductBrands(db),
  ])
  return (
    <PageBody>
      <PageHeader back={{ href: `/app/products/${id}`, label: data.values.name }} title={`Edit ${data.values.name}`} description="Variations with stock or history can be deactivated but not removed." />
      <ProductForm productId={id} initial={data.values} currentStock={data.currentStock} locks={data.locks} categories={categories} brands={brands} />
    </PageBody>
  )
}
