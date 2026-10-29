import "server-only"
import { randomUUID } from "node:crypto"
import type { Prisma } from "@/generated/prisma/client"
import { prisma, type TenantDb } from "@/server/db"
import { AppError, businessRule, forbidden, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import { assertBranch, branchFilter, can, type TenantContext } from "@/server/auth/context"
import { dec, num, round2, round4 } from "@/server/decimal"
import { issueStockFIFO, receiveStock } from "@/server/modules/inventory/stock"
import { scopedBranch } from "@/server/modules/inventory-ops/shared"
import {
  suggestSku,
  uniqueSku,
  type CategoryOutput,
  type ProductOutput,
  type VariationOutput,
  type variationPatchSchema,
} from "@/lib/validation/products"
import type { z } from "zod"

export const PRODUCT_SORTABLE = ["name", "createdAt", "updatedAt"]

export async function listProductBrands(db: TenantDb) {
  const rows = await db.product.findMany({
    where: { brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  })
  return rows.flatMap(({ brand }) => (brand ? [brand] : []))
}

// ───────── Categories ─────────

export async function listCategories(db: TenantDb) {
  const rows = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, children: true } }, parent: { select: { name: true } } },
  })
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    parentName: c.parent?.name ?? null,
    products: c._count.products,
    children: c._count.children,
  }))
}
export type CategoryRow = Awaited<ReturnType<typeof listCategories>>[number]

async function checkCategoryName(db: TenantDb, name: string, exceptId?: string) {
  const dup = await db.category.findFirst({ where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })
  if (dup) throw new AppError("CONFLICT", "A category with this name already exists", { fields: { name: "Already exists" } })
}

async function checkParent(db: TenantDb, parentId: string | null, selfId?: string) {
  if (!parentId) return
  if (parentId === selfId) throw new AppError("VALIDATION_ERROR", "A category cannot be its own parent", { fields: { parentId: "Invalid parent" } })
  const p = await db.category.findFirst({ where: { id: parentId }, select: { parentId: true } })
  if (!p) throw new AppError("VALIDATION_ERROR", "Choose a valid parent category", { fields: { parentId: "Invalid parent" } })
  if (selfId && p.parentId === selfId) throw new AppError("VALIDATION_ERROR", "That would create a loop", { fields: { parentId: "Invalid parent" } })
}

export async function createCategory(ctx: TenantContext, db: TenantDb, input: CategoryOutput) {
  await checkCategoryName(db, input.name)
  await checkParent(db, input.parentId)
  const c = await db.category.create({ data: { companyId: ctx.companyId, name: input.name, parentId: input.parentId } })
  await audit(ctx, { action: "create", entityType: "category", entityId: c.id, summary: `Created category ${c.name}` })
  return { id: c.id, name: c.name, parentId: c.parentId }
}

export async function updateCategory(ctx: TenantContext, db: TenantDb, id: string, input: CategoryOutput) {
  const before = await db.category.findFirst({ where: { id } })
  if (!before) throw notFound("Category")
  await checkCategoryName(db, input.name, id)
  await checkParent(db, input.parentId, id)
  const c = await db.category.update({ where: { id }, data: { name: input.name, parentId: input.parentId } })
  await audit(ctx, { action: "update", entityType: "category", entityId: id, summary: `Renamed category ${before.name} → ${c.name}`, before, after: c })
  return { id: c.id, name: c.name, parentId: c.parentId }
}

export async function deleteCategory(ctx: TenantContext, db: TenantDb, id: string) {
  const c = await db.category.findFirst({ where: { id }, include: { _count: { select: { products: true, children: true } } } })
  if (!c) throw notFound("Category")
  if (c._count.products) throw businessRule(`${c._count.products} product(s) use this category. Move them to another category first.`)
  if (c._count.children) throw businessRule("This category has sub-categories. Delete or move them first.")
  await db.category.delete({ where: { id } })
  await audit(ctx, { action: "delete", entityType: "category", entityId: id, summary: `Deleted category ${c.name}` })
}

// ───────── History locks (a variation with history can only be deactivated) ─────────

/** Returns variationId → reason for every variation that has stock or any document/ledger history. */
export async function variationLocks(ids: string[]) {
  const locks = new Map<string, string>()
  if (!ids.length) return locks
  const where = { variationId: { in: ids } }
  const sel = { variationId: true } as const
  const checks: [string, Promise<{ variationId: string }[]>][] = [
    ["has stock", prisma.stockBalance.findMany({ where: { ...where, quantity: { not: 0 } }, select: sel })],
    ["has stock movements", prisma.stockLedgerEntry.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["has inventory batches", prisma.inventoryBatch.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["appears on invoices", prisma.invoiceLine.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["appears on LCs", prisma.lcProductLine.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["appears on purchase orders", prisma.purchaseOrderLine.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["appears on goods receipts", prisma.goodsReceiptLine.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["appears on quotations / orders", prisma.salesOrderLine.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["appears on stock adjustments", prisma.stockAdjustmentLine.findMany({ where, select: sel, distinct: ["variationId"] })],
    ["appears on transfers", prisma.stockTransferLine.findMany({ where, select: sel, distinct: ["variationId"] })],
  ]
  const results = await Promise.all(checks.map((c) => c[1]))
  results.forEach((rows, i) => rows.forEach((r) => !locks.has(r.variationId) && locks.set(r.variationId, checks[i][0])))
  return locks
}

// ───────── Products ─────────

type ListArgs = {
  q?: string
  categoryId?: string
  status?: string
  branchId?: string
  skip: number
  take: number
  orderBy: Record<string, "asc" | "desc">
}

/** Product list: variations, price range and stock (Σ StockBalance over the user's branches or the chosen one). */
export async function listProducts(ctx: TenantContext, db: TenantDb, a: ListArgs) {
  const where: Prisma.ProductWhereInput = {
    ...(a.q
      ? {
          OR: [
            { name: { contains: a.q } },
            { brand: { contains: a.q } },
            { variations: { some: { OR: [{ sku: { contains: a.q } }, { barcode: a.q }, { name: { contains: a.q } }] } } },
          ],
        }
      : {}),
    ...(a.categoryId === "none" ? { categoryId: null } : a.categoryId ? { categoryId: a.categoryId } : {}),
    ...(a.status === "active" || a.status === "inactive" ? { status: a.status } : {}),
  }
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: a.orderBy,
      skip: a.skip,
      take: a.take,
      include: {
        category: { select: { name: true } },
        variations: { select: { id: true, salePrice: true, status: true, reorderLevel: true } },
      },
    }),
    db.product.count({ where }),
  ])
  const varIds = rows.flatMap((p) => p.variations.map((v) => v.id))
  const balances = varIds.length
    ? await db.stockBalance.groupBy({
        by: ["variationId"],
        where: { variationId: { in: varIds }, ...branchFilter(ctx, a.branchId) },
        _sum: { quantity: true },
      })
    : []
  const stock = new Map(balances.map((b) => [b.variationId, dec(b._sum.quantity)]))
  return {
    total,
    rows: rows.map((p) => {
      const prices = p.variations.filter((v) => v.status === "active").map((v) => num(v.salePrice))
      const qty = p.variations.reduce((acc, v) => acc.plus(stock.get(v.id) ?? 0), dec(0))
      const low = p.variations.filter((v) => v.status === "active" && dec(v.reorderLevel).gt(0) && (stock.get(v.id) ?? dec(0)).lte(v.reorderLevel)).length
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        unit: p.unit,
        imageUrl: p.imageUrl,
        category: p.category?.name ?? null,
        status: p.status,
        variations: p.variations.length,
        priceMin: prices.length ? Math.min(...prices) : null,
        priceMax: prices.length ? Math.max(...prices) : null,
        stock: num(qty),
        lowStock: low,
      }
    }),
  }
}
export type ProductListRow = Awaited<ReturnType<typeof listProducts>>["rows"][number]

const productData = (input: ProductOutput) => ({
  name: input.name,
  categoryId: input.categoryId,
  brand: input.brand,
  note: input.note,
  unit: input.unit,
  description: input.description,
  imageUrl: input.imageUrl,
  status: input.status,
})

const variationData = (v: VariationOutput) => ({
  name: v.name,
  barcode: v.barcode,
  unitWeight: dec(v.unitWeight),
  salePrice: dec(v.salePrice),
  wholesalePrice: v.wholesalePrice == null ? null : dec(v.wholesalePrice),
  reorderLevel: dec(v.reorderLevel),
  status: v.status,
})

type ProductOpeningLine = { variationId: string; sku: string; quantity: Prisma.Decimal; unitCost: Prisma.Decimal }
type ProductStockTarget = { variationId: string; sku: string; quantity: Prisma.Decimal; unitCost?: Prisma.Decimal }

async function postProductOpeningStock(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  branch: ReturnType<typeof scopedBranch>,
  product: { id: string; name: string },
  lines: ProductOpeningLine[],
) {
  const refId = randomUUID()
  let totalValue = dec(0)
  let totalUnits = dec(0)
  for (const line of lines) {
    await receiveStock(tx, {
      companyId: ctx.companyId,
      branchId: branch.id,
      variationId: line.variationId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      source: "opening",
      type: "opening",
      batchNo: "OPENING",
      refType: "opening",
      refId,
      userId: ctx.userId,
      note: `Opening stock for ${product.name}`,
    })
    totalUnits = totalUnits.plus(line.quantity)
    totalValue = totalValue.plus(line.quantity.times(line.unitCost))
  }
  await audit(
    ctx,
    {
      action: "create",
      entityType: "opening_stock",
      entityId: refId,
      summary: `Opening stock at ${branch.name}: ${lines.length} item(s), ${totalUnits.toString()} units, ৳${round2(totalValue).toFixed(2)}`,
      after: {
        branchId: branch.id,
        productId: product.id,
        lines: lines.map((line) => ({
          variationId: line.variationId,
          sku: line.sku,
          quantity: line.quantity.toString(),
          unitCost: line.unitCost.toString(),
        })),
      },
    },
    tx,
  )
  return { variations: lines.length, units: totalUnits.toString(), value: round2(totalValue).toString() }
}

async function setProductStock(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  branch: ReturnType<typeof scopedBranch>,
  product: { id: string; name: string },
  lines: ProductStockTarget[],
) {
  const refId = randomUUID()
  const changes: { variationId: string; sku: string; previous: string; target: string; delta: string; unitCost: string | null }[] = []
  for (const line of lines) {
    const balance = await tx.stockBalance.findUnique({
      where: { branchId_variationId: { branchId: branch.id, variationId: line.variationId } },
      select: { quantity: true },
    })
    const previous = dec(balance?.quantity ?? 0)
    const delta = line.quantity.minus(previous)
    if (delta.isZero()) continue

    if (delta.gt(0)) {
      if (line.unitCost == null) throw new AppError("VALIDATION_ERROR", `Enter a unit cost to increase stock for ${line.sku}`)
      await receiveStock(tx, {
        companyId: ctx.companyId,
        branchId: branch.id,
        variationId: line.variationId,
        quantity: delta,
        unitCost: line.unitCost,
        source: "adjustment",
        type: "adjustment_in",
        batchNo: "PRODUCT-EDIT",
        refType: "product_stock_update",
        refId,
        userId: ctx.userId,
        note: `Stock target update for ${product.name}`,
      })
    } else {
      await issueStockFIFO(tx, {
        companyId: ctx.companyId,
        branchId: branch.id,
        variationId: line.variationId,
        quantity: delta.abs(),
        type: "adjustment_out",
        refType: "product_stock_update",
        refId,
        userId: ctx.userId,
        note: `Stock target update for ${product.name}`,
        label: `${product.name} — ${line.sku}`,
      })
    }

    changes.push({
      variationId: line.variationId,
      sku: line.sku,
      previous: previous.toString(),
      target: line.quantity.toString(),
      delta: delta.toString(),
      unitCost: delta.gt(0) ? line.unitCost!.toString() : null,
    })
  }
  if (!changes.length) return null

  await audit(
    ctx,
    {
      action: "update",
      entityType: "product_stock",
      entityId: refId,
      summary: `Updated stock for ${product.name} at ${branch.name}: ${changes.length} variation(s)`,
      after: { branchId: branch.id, productId: product.id, changes },
    },
    tx,
  )
  return { variations: changes.length, units: changes.reduce((total, change) => total.plus(dec(change.delta).abs()), dec(0)).toString() }
}

async function checkCategory(db: TenantDb, categoryId: string | null) {
  if (!categoryId) return
  const c = await db.category.findFirst({ where: { id: categoryId }, select: { id: true } })
  if (!c) throw new AppError("VALIDATION_ERROR", "Choose a valid category", { fields: { categoryId: "Invalid category" } })
}

/** SKU is unique per company: explicit SKUs must be free, blank ones are generated from the names. */
async function resolveSkus(companyId: string, productName: string, variations: VariationOutput[], ownIds: string[]) {
  const explicit = variations.map((v) => v.sku).filter((s): s is string => !!s)
  if (explicit.length) {
    const clashes = await prisma.productVariation.findMany({
      where: { companyId, sku: { in: explicit }, id: { notIn: ownIds } },
      select: { sku: true, name: true, product: { select: { name: true } } },
    })
    if (clashes.length) {
      const by = new Map(clashes.map((c) => [c.sku.toUpperCase(), c]))
      const fields: Record<string, string> = {}
      variations.forEach((v, i) => {
        const c = v.sku ? by.get(v.sku.toUpperCase()) : undefined
        if (c) fields[`variations.${i}.sku`] = `Already used by ${c.product.name} — ${c.name}`
      })
      throw new AppError("CONFLICT", "Some SKUs are already used by other products", { fields })
    }
  }
  const used = new Set(explicit)
  const out: string[] = []
  for (const v of variations) {
    if (v.sku) {
      out.push(v.sku)
      continue
    }
    const base = suggestSku(productName, v.name)
    const existing = await prisma.productVariation.findMany({
      where: { companyId, sku: { startsWith: base }, id: { notIn: ownIds } },
      select: { sku: true },
    })
    const sku = uniqueSku(base, [...used, ...existing.map((e) => e.sku)])
    used.add(sku)
    out.push(sku)
  }
  return out
}

export async function createProduct(ctx: TenantContext, db: TenantDb, input: ProductOutput) {
  if (ctx.plan.maxProducts != null) {
    const used = await db.product.count()
    if (used >= ctx.plan.maxProducts)
      throw new AppError("PLAN_LIMIT", `Your ${ctx.plan.name} plan allows ${ctx.plan.maxProducts} products. Upgrade to add more.`, {
        limit: ctx.plan.maxProducts,
      })
  }
  await checkCategory(db, input.categoryId)
  const skus = await resolveSkus(ctx.companyId, input.name, input.variations, [])
  const openingLines = input.variations.flatMap((variation, index) =>
    variation.openingQuantity != null && variation.openingQuantity > 0
      ? [{ index, quantity: dec(variation.openingQuantity), unitCost: round4(variation.openingUnitCost!) }]
      : [],
  )
  let openingBranch: ReturnType<typeof scopedBranch> | null = null
  if (openingLines.length) {
    assertBranch(ctx, ctx.activeBranchId)
    openingBranch = scopedBranch(ctx, ctx.activeBranchId)
  }

  return prisma.$transaction(async (tx) => {
    const { categoryId, ...data } = productData(input)
    const p = await tx.product.create({
      data: {
        companyId: ctx.companyId,
        ...data,
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
        variations: { create: input.variations.map((v, i) => ({ companyId: ctx.companyId, ...variationData(v), sku: skus[i] })) },
      },
      include: { variations: { select: { id: true, sku: true } } },
    })
    const openingStock = openingBranch
      ? await postProductOpeningStock(
        tx,
        ctx,
        openingBranch,
        p,
        openingLines.map((line) => {
          const variation = p.variations.find((item) => item.sku === skus[line.index])
          if (!variation) throw new Error("Created product variation could not be matched to its SKU")
          return { ...line, variationId: variation.id, sku: skus[line.index] }
        }),
      )
      : null
    await audit(
      ctx,
      {
        action: "create",
        entityType: "product",
        entityId: p.id,
        summary: `Created product ${p.name} (${input.variations.length} variation${input.variations.length === 1 ? "" : "s"})`,
        after: {
          ...productData(input),
          variations: input.variations.map((v, i) => ({ ...variationData(v), sku: skus[i] })),
          openingStock: openingLines.length ? { branchId: openingBranch?.id, lines: openingLines.map((line) => ({ sku: skus[line.index], quantity: line.quantity.toString(), unitCost: line.unitCost.toString() })) } : undefined,
        },
      },
      tx,
    )
    return { id: p.id, skus, openingStock }
  }, { timeout: 30_000, maxWait: 10_000 })
}

export async function updateProduct(ctx: TenantContext, db: TenantDb, id: string, input: ProductOutput) {
  const before = await db.product.findFirst({ where: { id }, include: { variations: true } })
  if (!before) throw notFound("Product")
  await checkCategory(db, input.categoryId)
  const existingIds = new Set(before.variations.map((v) => v.id))
  const fields: Record<string, string> = {}
  input.variations.forEach((v, i) => {
    if (v.id && !existingIds.has(v.id)) fields[`variations.${i}.name`] = "This variation does not belong to the product"
  })
  if (Object.keys(fields).length) throw new AppError("VALIDATION_ERROR", "Invalid variation", { fields })

  const keep = new Set(input.variations.map((v) => v.id).filter(Boolean))
  const removed = before.variations.filter((v) => !keep.has(v.id))
  if (removed.length) {
    const locks = await variationLocks(removed.map((v) => v.id))
    const blocked = removed.find((v) => locks.has(v.id))
    if (blocked) throw businessRule(`"${blocked.name}" ${locks.get(blocked.id)} and cannot be removed. Set it to inactive instead.`)
  }
  const skus = await resolveSkus(ctx.companyId, input.name, input.variations, [...existingIds])
  const stockTargets = input.variations.flatMap((variation, index) =>
    variation.openingQuantity != null
      ? [{
          index,
          quantity: dec(variation.openingQuantity),
          ...(variation.openingUnitCost != null ? { unitCost: round4(variation.openingUnitCost) } : {}),
        }]
      : [],
  )
  let openingBranch: ReturnType<typeof scopedBranch> | null = null
  if (stockTargets.length) {
    assertBranch(ctx, ctx.activeBranchId)
    if (!can(ctx, "inventory.adjust")) throw forbidden("You are not allowed to post opening stock")
    openingBranch = scopedBranch(ctx, ctx.activeBranchId)
  }

  const openingStock = await prisma.$transaction(async (tx) => {
    if (removed.length) await tx.productVariation.deleteMany({ where: { id: { in: removed.map((v) => v.id) }, companyId: ctx.companyId } })
    await tx.product.update({ where: { id }, data: productData(input) })
    const variationIds: string[] = []
    for (const [i, v] of input.variations.entries()) {
      if (v.id) {
        await tx.productVariation.update({ where: { id: v.id }, data: { ...variationData(v), sku: skus[i] } })
        variationIds[i] = v.id
      } else {
        const variation = await tx.productVariation.create({ data: { companyId: ctx.companyId, productId: id, ...variationData(v), sku: skus[i] } })
        variationIds[i] = variation.id
      }
    }
    const openingStock = openingBranch
      ? await setProductStock(
        tx,
        ctx,
        openingBranch,
        { id, name: input.name },
        stockTargets.map((line) => ({
          quantity: line.quantity,
          ...(line.unitCost != null ? { unitCost: line.unitCost } : {}),
          variationId: variationIds[line.index],
          sku: skus[line.index],
        })),
      )
      : null
    const priceChanges = input.variations
      .map((v) => {
        const old = v.id ? before.variations.find((b) => b.id === v.id) : undefined
        return old && !dec(old.salePrice).eq(v.salePrice) ? `${v.name} ৳${num(old.salePrice)}→৳${v.salePrice}` : null
      })
      .filter(Boolean)
    await audit(
      ctx,
      {
        action: "update",
        entityType: "product",
        entityId: id,
        summary: `Updated product ${input.name}${priceChanges.length ? ` — price: ${priceChanges.join(", ")}` : ""}${removed.length ? ` — removed ${removed.map((r) => r.name).join(", ")}` : ""}`,
        before: {
          name: before.name,
          categoryId: before.categoryId,
          brand: before.brand,
          unit: before.unit,
          status: before.status,
          variations: before.variations.map((v) => ({ id: v.id, name: v.name, sku: v.sku, salePrice: num(v.salePrice), wholesalePrice: v.wholesalePrice == null ? null : num(v.wholesalePrice), status: v.status })),
        },
        after: {
          ...productData(input),
          variations: input.variations.map((v, i) => ({ ...variationData(v), sku: skus[i] })),
        },
      },
      tx,
    )
    return openingStock
  }, { timeout: 30_000, maxWait: 10_000 })
  return { id, openingStock }
}

export async function deleteProduct(ctx: TenantContext, db: TenantDb, id: string) {
  const p = await db.product.findFirst({ where: { id }, include: { variations: { select: { id: true, name: true } } } })
  if (!p) throw notFound("Product")
  const locks = await variationLocks(p.variations.map((v) => v.id))
  const blocked = p.variations.find((v) => locks.has(v.id))
  if (blocked) throw businessRule(`"${blocked.name}" ${locks.get(blocked.id)}, so this product cannot be deleted. Set it to inactive instead.`)
  await prisma.$transaction(async (tx) => {
    await tx.productVariation.deleteMany({ where: { productId: id, companyId: ctx.companyId } })
    await tx.product.delete({ where: { id } })
    await audit(ctx, { action: "delete", entityType: "product", entityId: id, summary: `Deleted product ${p.name}` }, tx)
  })
}

export async function patchVariation(ctx: TenantContext, db: TenantDb, id: string, input: z.output<typeof variationPatchSchema>) {
  const before = await db.productVariation.findFirst({ where: { id }, include: { product: { select: { name: true } } } })
  if (!before) throw notFound("Variation")
  const data: Prisma.ProductVariationUpdateInput = {}
  if (input.status) data.status = input.status
  if (input.salePrice != null) data.salePrice = dec(input.salePrice)
  if (input.wholesalePrice !== undefined) data.wholesalePrice = input.wholesalePrice == null ? null : dec(input.wholesalePrice)
  if (input.reorderLevel != null) data.reorderLevel = dec(input.reorderLevel)
  const v = await db.productVariation.update({ where: { id }, data })
  await audit(ctx, {
    action: "update",
    entityType: "variation",
    entityId: id,
    summary: `Updated ${before.product.name} — ${before.name}`,
    before: { status: before.status, salePrice: num(before.salePrice), wholesalePrice: before.wholesalePrice == null ? null : num(before.wholesalePrice), reorderLevel: num(before.reorderLevel) },
    after: { status: v.status, salePrice: num(v.salePrice), wholesalePrice: v.wholesalePrice == null ? null : num(v.wholesalePrice), reorderLevel: num(v.reorderLevel) },
  })
  return { id, status: v.status, salePrice: num(v.salePrice) }
}

export async function deleteVariation(ctx: TenantContext, db: TenantDb, id: string) {
  const v = await db.productVariation.findFirst({ where: { id }, include: { product: { select: { name: true, _count: { select: { variations: true } } } } } })
  if (!v) throw notFound("Variation")
  if (v.product._count.variations <= 1) throw businessRule("A product needs at least one variation. Delete the product instead.")
  const locks = await variationLocks([id])
  if (locks.has(id)) throw businessRule(`"${v.name}" ${locks.get(id)} and cannot be deleted. Set it to inactive instead.`)
  await db.productVariation.delete({ where: { id } })
  await audit(ctx, { action: "delete", entityType: "variation", entityId: id, summary: `Deleted variation ${v.product.name} — ${v.name} (${v.sku})` })
}

/** Values for the edit form, plus which variations are locked by history. */
export async function getProductForEdit(ctx: TenantContext, db: TenantDb, id: string) {
  const p = await db.product.findFirst({ where: { id }, include: { variations: { orderBy: { createdAt: "asc" } } } })
  if (!p) throw notFound("Product")
  const [locks, balances] = await Promise.all([
    variationLocks(p.variations.map((v) => v.id)),
    p.variations.length
      ? db.stockBalance.findMany({
          where: { variationId: { in: p.variations.map((v) => v.id) }, branchId: ctx.activeBranchId },
          select: { variationId: true, quantity: true },
        })
      : Promise.resolve([]),
  ])
  const currentStock = Object.fromEntries(balances.map((balance) => [balance.variationId, num(balance.quantity)]))
  return {
    id: p.id,
    currentStock,
    values: {
      name: p.name,
      categoryId: p.categoryId ?? "none",
      brand: p.brand ?? "",
      note: p.note ?? "",
      unit: p.unit as ProductOutput["unit"],
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      status: p.status,
      variations: p.variations.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode ?? "",
        unitWeight: num(v.unitWeight),
        salePrice: num(v.salePrice),
        wholesalePrice: v.wholesalePrice == null ? "" : num(v.wholesalePrice),
        reorderLevel: num(v.reorderLevel),
        openingQuantity: "",
        openingUnitCost: "",
        status: v.status,
      })),
    },
    locks: Object.fromEntries(locks),
  }
}

/** Product detail: per-variation stock by branch (INV-01/INV-03) and, with permission, average available cost. */
export async function getProductDetail(ctx: TenantContext, db: TenantDb, id: string) {
  const p = await db.product.findFirst({
    where: { id },
    include: { category: { select: { id: true, name: true } }, variations: { orderBy: { createdAt: "asc" } } },
  })
  if (!p) throw notFound("Product")
  const ids = p.variations.map((v) => v.id)
  const showCost = can(ctx, "inventory.view_cost")
  const [balances, batches, locks] = await Promise.all([
    ids.length ? db.stockBalance.findMany({ where: { variationId: { in: ids }, branchId: { in: ctx.branchIds } } }) : Promise.resolve([]),
    showCost && ids.length
      ? db.inventoryBatch.findMany({
          where: { variationId: { in: ids }, branchId: { in: ctx.branchIds }, qtyAvailable: { gt: 0 } },
          select: { variationId: true, qtyAvailable: true, unitCost: true },
        })
      : Promise.resolve([]),
    variationLocks(ids),
  ])
  const costAgg = new Map<string, { qty: Prisma.Decimal; value: Prisma.Decimal }>()
  for (const b of batches) {
    const g = costAgg.get(b.variationId) ?? { qty: dec(0), value: dec(0) }
    g.qty = g.qty.plus(b.qtyAvailable)
    g.value = g.value.plus(dec(b.qtyAvailable).times(b.unitCost))
    costAgg.set(b.variationId, g)
  }
  const variations = p.variations.map((v) => {
    const byBranch: Record<string, number> = {}
    let total = dec(0)
    for (const b of balances.filter((x) => x.variationId === v.id)) {
      byBranch[b.branchId] = num(b.quantity)
      total = total.plus(b.quantity)
    }
    const c = costAgg.get(v.id)
    const avgCost = showCost && c && c.qty.gt(0) ? num(round4(c.value.div(c.qty))) : null
    return {
      id: v.id,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      unitWeight: num(v.unitWeight),
      salePrice: num(v.salePrice),
      wholesalePrice: v.wholesalePrice == null ? null : num(v.wholesalePrice),
      reorderLevel: num(v.reorderLevel),
      status: v.status,
      stockByBranch: byBranch,
      totalStock: num(total),
      avgCost,
      stockValue: showCost && c ? num(c.value.toDecimalPlaces(2)) : null,
      lock: locks.get(v.id) ?? null,
    }
  })
  return {
    product: {
      id: p.id,
      name: p.name,
      brand: p.brand,
      note: p.note,
      unit: p.unit,
      description: p.description,
      imageUrl: p.imageUrl,
      status: p.status,
      category: p.category,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    },
    branches: ctx.branches.map((b) => ({ id: b.id, name: b.name, code: b.code })),
    variations,
    showCost,
    deletable: !variations.some((v) => v.lock),
  }
}
export type ProductDetail = Awaited<ReturnType<typeof getProductDetail>>
