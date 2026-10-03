import "server-only"
import type { TenantContext } from "@/server/auth/context"
import type { TenantDb } from "@/server/db"
import { num } from "@/server/decimal"

export type VariationOption = {
  id: string
  productId: string
  productName: string
  name: string
  sku: string
  barcode: string | null
  unit: string
  unitWeight: number
  salePrice: number
  wholesalePrice: number | null
  stock: number
}

/** Product/variation search by name, SKU or barcode (NFR-UX-02) with stock in a branch. */
export async function searchVariations(ctx: TenantContext, db: TenantDb, q: string, branchId?: string, limit = 20): Promise<VariationOption[]> {
  const term = q.trim()
  const rows = await db.productVariation.findMany({
    where: {
      status: "active",
      product: { status: "active" },
      ...(term
        ? {
            OR: [
              { sku: { contains: term } },
              { barcode: term },
              { name: { contains: term } },
              { product: { name: { contains: term } } },
            ],
          }
        : {}),
    },
    include: {
      product: { select: { name: true, unit: true } },
      balances: branchId ? { where: { branchId } } : { where: { branchId: { in: ctx.branchIds } } },
    },
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
    take: limit,
  })
  return rows.map((v) => ({
    id: v.id,
    productId: v.productId,
    productName: v.product.name,
    name: v.name,
    sku: v.sku,
    barcode: v.barcode,
    unit: v.product.unit,
    unitWeight: num(v.unitWeight),
    salePrice: num(v.salePrice),
    wholesalePrice: v.wholesalePrice == null ? null : num(v.wholesalePrice),
    stock: v.balances.reduce((a, b) => a + num(b.quantity), 0),
  }))
}
