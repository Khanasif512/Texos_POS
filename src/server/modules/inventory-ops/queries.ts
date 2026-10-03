import "server-only"
import { Prisma } from "@/generated/prisma/client"
import { branchFilter, can, type TenantContext } from "@/server/auth/context"
import { forbidden } from "@/server/errors"
import { prisma } from "@/server/db"
import { dec, num, round2, sum } from "@/server/decimal"
import { ADJUSTMENT_REASONS } from "@/lib/validation/inventory"
import { stockValue } from "./calc"
import { branchMap, isoDate, variationInfo } from "./shared"

const dateOnlyRange = (from?: string, to?: string) => {
  if (!from && !to) return undefined
  const r: { gte?: Date; lte?: Date } = {}
  if (from) r.gte = new Date(`${from}T00:00:00.000Z`)
  if (to) r.lte = new Date(`${to}T00:00:00.000Z`)
  return r
}
const timeRange = (from?: string, to?: string) => {
  if (!from && !to) return undefined
  const r: { gte?: Date; lte?: Date } = {}
  if (from) r.gte = new Date(`${from}T00:00:00`)
  if (to) r.lte = new Date(`${to}T23:59:59.999`)
  return r
}

/** Branches shown as stock columns: the requested one, or every branch in the user's scope. */
function scopeBranches(ctx: TenantContext, branchId?: string) {
  if (branchId && branchId !== "all") {
    const b = ctx.branches.find((x) => x.id === branchId)
    if (!b) throw forbidden("You do not have access to this branch")
    return [b]
  }
  return ctx.branches
}

// ───────────────────────────── Stock by branch (INV-03) ─────────────────────────────

export const STOCK_SORTABLE = ["product", "sku", "reorderLevel"]

export async function stockOverview(
  ctx: TenantContext,
  a: { q?: string; branchId?: string; stock?: string; sort: string; skip: number; take: number },
) {
  const branches = scopeBranches(ctx, a.branchId)
  const ids = branches.map((b) => b.id)
  const showCost = can(ctx, "inventory.view_cost")
  const [field, dir] = a.sort.split(":") as [string, "asc" | "desc"]
  const orderBy: Prisma.ProductVariationOrderByWithRelationInput[] =
    field === "sku" ? [{ sku: dir }] : field === "reorderLevel" ? [{ reorderLevel: dir }, { sku: "asc" }] : [{ product: { name: dir } }, { name: "asc" }]
  const where: Prisma.ProductVariationWhereInput = {
    companyId: ctx.companyId,
    status: "active",
    product: { status: "active" },
    ...(a.q
      ? { OR: [{ sku: { contains: a.q } }, { barcode: a.q }, { name: { contains: a.q } }, { product: { name: { contains: a.q } } }] }
      : {}),
    ...(a.stock === "in_stock"
      ? { balances: { some: { branchId: { in: ids }, quantity: { gt: 0 } } } }
      : a.stock === "out_of_stock"
        ? { balances: { none: { branchId: { in: ids }, quantity: { gt: 0 } } } }
        : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.productVariation.findMany({
      where,
      orderBy,
      skip: a.skip,
      take: a.take,
      include: { product: { select: { name: true, unit: true } }, balances: { where: { branchId: { in: ids } } } },
    }),
    prisma.productVariation.count({ where }),
  ])
  const varIds = rows.map((r) => r.id)
  const batches =
    showCost && varIds.length
      ? await prisma.inventoryBatch.findMany({
          where: { companyId: ctx.companyId, variationId: { in: varIds }, branchId: { in: ids }, qtyAvailable: { gt: 0 } },
          select: { variationId: true, qtyAvailable: true, unitCost: true },
        })
      : []
  return {
    total,
    showCost,
    branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code })),
    rows: rows.map((v) => {
      const per: Record<string, number> = {}
      for (const b of v.balances) per[b.branchId] = num(b.quantity)
      const totalQty = sum(v.balances.map((b) => b.quantity))
      const lowIn = branches.filter((b) => v.reorderLevel.gt(0) && dec(per[b.id] ?? 0).lte(v.reorderLevel)).map((b) => b.id)
      return {
        id: v.id,
        productName: v.product.name,
        name: v.name,
        sku: v.sku,
        unit: v.product.unit,
        reorderLevel: num(v.reorderLevel),
        perBranch: per,
        total: num(totalQty),
        lowIn,
        value: showCost ? num(stockValue(batches.filter((b) => b.variationId === v.id)).toString()) : null,
      }
    }),
  }
}
export type StockRow = Awaited<ReturnType<typeof stockOverview>>["rows"][number]

/** Headline numbers for the stock page (scope = branch filter or all permitted branches). */
export async function stockSummary(ctx: TenantContext, branchId?: string) {
  const ids = scopeBranches(ctx, branchId).map((b) => b.id)
  const showCost = can(ctx, "inventory.view_cost")
  const [units, skus, valueRow, low] = await Promise.all([
    prisma.stockBalance.aggregate({ where: { companyId: ctx.companyId, branchId: { in: ids } }, _sum: { quantity: true } }),
    prisma.stockBalance.findMany({
      where: { companyId: ctx.companyId, branchId: { in: ids }, quantity: { gt: 0 } },
      distinct: ["variationId"],
      select: { variationId: true },
    }),
    showCost
      ? prisma.$queryRaw<{ v: string | null }[]>`
          SELECT SUM(qtyAvailable * unitCost) AS v FROM inventory_batches
          WHERE companyId = ${ctx.companyId} AND branchId IN (${Prisma.join(ids)}) AND qtyAvailable > 0`
      : Promise.resolve([{ v: null }]),
    lowStockCount(ctx, ids),
  ])
  return {
    units: num(units._sum.quantity),
    skusInStock: skus.length,
    value: showCost ? num(round2(valueRow[0]?.v ?? 0)) : null,
    lowCount: low,
  }
}

// ───────────────────────────── Low stock ─────────────────────────────

function lowStockSql(ctx: TenantContext, ids: string[], q?: string) {
  const term = q ? `%${q}%` : null
  return Prisma.sql`
    FROM product_variations v
    JOIN products p ON p.id = v.productId
    JOIN branches b ON b.companyId = v.companyId AND b.id IN (${Prisma.join(ids)})
    LEFT JOIN stock_balances sb ON sb.branchId = b.id AND sb.variationId = v.id
    WHERE v.companyId = ${ctx.companyId} AND v.status = 'active' AND p.status = 'active' AND v.reorderLevel > 0
      AND COALESCE(sb.quantity, 0) <= v.reorderLevel
      ${term ? Prisma.sql`AND (v.sku LIKE ${term} OR v.name LIKE ${term} OR p.name LIKE ${term})` : Prisma.empty}`
}

async function lowStockCount(ctx: TenantContext, ids: string[]) {
  if (!ids.length) return 0
  const [row] = await prisma.$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(*) AS n ${lowStockSql(ctx, ids)}`
  return Number(row?.n ?? 0)
}

export async function lowStock(ctx: TenantContext, a: { q?: string; branchId?: string; skip: number; take: number }) {
  const ids = scopeBranches(ctx, a.branchId).map((b) => b.id)
  if (!ids.length) return { total: 0, rows: [] }
  const [rows, total, branches] = await Promise.all([
    prisma.$queryRaw<
      { variationId: string; sku: string; name: string; productName: string; unit: string; reorderLevel: string; branchId: string; qty: string }[]
    >`
      SELECT v.id AS variationId, v.sku, v.name, p.name AS productName, p.unit, v.reorderLevel, b.id AS branchId,
             COALESCE(sb.quantity, 0) AS qty
      ${lowStockSql(ctx, ids, a.q)}
      ORDER BY (COALESCE(sb.quantity, 0) / v.reorderLevel) ASC, p.name ASC, v.name ASC
      LIMIT ${a.take} OFFSET ${a.skip}`,
    prisma.$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(*) AS n ${lowStockSql(ctx, ids, a.q)}`,
    branchMap(prisma, ctx.companyId),
  ])
  return {
    total: Number(total[0]?.n ?? 0),
    rows: rows.map((r) => {
      const qty = num(r.qty)
      const reorder = num(r.reorderLevel)
      return {
        key: `${r.variationId}:${r.branchId}`,
        variationId: r.variationId,
        productName: r.productName,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        branchId: r.branchId,
        branchName: branches.get(r.branchId)?.name ?? "—",
        quantity: qty,
        reorderLevel: reorder,
        shortfall: Math.max(0, num(dec(r.reorderLevel).minus(dec(r.qty)))),
        out: qty <= 0,
      }
    }),
  }
}
export type LowStockRow = Awaited<ReturnType<typeof lowStock>>["rows"][number]

// ───────────────────────────── Variation stock card ─────────────────────────────

const STOCK_TXN_TYPES = ["opening", "purchase_in", "sale_out", "return_in", "cancel_in", "adjustment_in", "adjustment_out", "transfer_in", "transfer_out"]

const REF_LABEL: Record<string, string> = {
  grn: "Goods receipt",
  adjustment: "Adjustment",
  opening: "Opening stock",
  transfer: "Transfer",
  invoice: "Invoice",
  sales_return: "Sales return",
  return: "Sales return",
}

/** Resolve document numbers/links for ledger references. */
async function resolveRefs(companyId: string, refs: { refType: string | null; refId: string | null }[]) {
  const ids = (t: string[]) => [...new Set(refs.filter((r) => r.refType && t.includes(r.refType) && r.refId).map((r) => r.refId!))]
  const [grn, adj, trf, inv, ret] = await Promise.all([
    ids(["grn"]).length ? prisma.goodsReceipt.findMany({ where: { companyId, id: { in: ids(["grn"]) } }, select: { id: true, number: true } }) : [],
    ids(["adjustment"]).length
      ? prisma.stockAdjustment.findMany({ where: { companyId, id: { in: ids(["adjustment"]) } }, select: { id: true, number: true } })
      : [],
    ids(["transfer"]).length ? prisma.stockTransfer.findMany({ where: { companyId, id: { in: ids(["transfer"]) } }, select: { id: true, number: true } }) : [],
    ids(["invoice"]).length ? prisma.invoice.findMany({ where: { companyId, id: { in: ids(["invoice"]) } }, select: { id: true, number: true } }) : [],
    ids(["sales_return", "return"]).length
      ? prisma.salesReturn.findMany({ where: { companyId, id: { in: ids(["sales_return", "return"]) } }, select: { id: true, number: true } })
      : [],
  ])
  const map = new Map<string, { number: string; href: string | null }>()
  for (const r of grn) map.set(`grn:${r.id}`, { number: r.number, href: `/app/purchases/receipts/${r.id}` })
  for (const r of adj) map.set(`adjustment:${r.id}`, { number: r.number, href: `/app/inventory/adjustments/${r.id}` })
  for (const r of trf) map.set(`transfer:${r.id}`, { number: r.number, href: `/app/inventory/transfers/${r.id}` })
  for (const r of inv) map.set(`invoice:${r.id}`, { number: r.number, href: `/app/sales/invoices/${r.id}` })
  for (const r of ret) {
    map.set(`sales_return:${r.id}`, { number: r.number, href: `/app/sales/returns/${r.id}` })
    map.set(`return:${r.id}`, { number: r.number, href: `/app/sales/returns/${r.id}` })
  }
  return (refType: string | null, refId: string | null) => {
    const hit = refType && refId ? map.get(`${refType}:${refId}`) : undefined
    return { label: (refType && REF_LABEL[refType]) ?? refType ?? "—", number: hit?.number ?? null, href: hit?.href ?? null }
  }
}

export async function stockCard(
  ctx: TenantContext,
  variationId: string,
  a: { q?: string; branchId?: string; allBatches?: boolean; type?: string; from?: string; to?: string; skip: number; take: number },
) {
  const v = await prisma.productVariation.findFirst({
    where: { id: variationId, companyId: ctx.companyId },
    include: { product: { select: { id: true, name: true, unit: true } }, balances: { where: { branchId: { in: ctx.branchIds } } } },
  })
  if (!v) return null
  const filter = branchFilter(ctx, a.branchId)
  const showCost = can(ctx, "inventory.view_cost")
  const ledgerWhere: Prisma.StockLedgerEntryWhereInput = {
    companyId: ctx.companyId,
    variationId,
    ...filter,
    ...(a.type && STOCK_TXN_TYPES.includes(a.type) ? { type: a.type as Prisma.EnumStockTxnTypeFilter["equals"] } : {}),
    ...(timeRange(a.from, a.to) ? { createdAt: timeRange(a.from, a.to) } : {}),
    ...(a.q ? { note: { contains: a.q } } : {}),
  }
  const [batches, ledger, ledgerTotal, branches] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where: { companyId: ctx.companyId, variationId, ...filter, ...(a.allBatches ? {} : { qtyAvailable: { gt: 0 } }) },
      orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
      take: 300,
    }),
    prisma.stockLedgerEntry.findMany({ where: ledgerWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: a.skip, take: a.take }),
    prisma.stockLedgerEntry.count({ where: ledgerWhere }),
    branchMap(prisma, ctx.companyId),
  ])
  const lcIds = [...new Set(batches.flatMap((b) => (b.lcId ? [b.lcId] : [])))]
  const lcs = lcIds.length ? await prisma.lc.findMany({ where: { companyId: ctx.companyId, id: { in: lcIds } }, select: { id: true, lcNumber: true } }) : []
  const ref = await resolveRefs(ctx.companyId, ledger)
  const userIds = [...new Set(ledger.flatMap((l) => (l.createdById ? [l.createdById] : [])))]
  const users = userIds.length ? await prisma.user.findMany({ where: { companyId: ctx.companyId, id: { in: userIds } }, select: { id: true, name: true } }) : []
  const available = batches.filter((b) => b.qtyAvailable.gt(0))
  return {
    variation: {
      id: v.id,
      productId: v.product.id,
      productName: v.product.name,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      unit: v.product.unit,
      reorderLevel: num(v.reorderLevel),
      salePrice: num(v.salePrice),
      status: v.status,
    },
    showCost,
    balances: ctx.branches.map((b) => {
      const bal = v.balances.find((x) => x.branchId === b.id)
      return { branchId: b.id, branchName: b.name, code: b.code, quantity: num(bal?.quantity ?? 0) }
    }),
    total: num(sum(v.balances.map((b) => b.quantity))),
    value: showCost ? num(stockValue(available.filter((b) => ctx.branchIds.includes(b.branchId))).toString()) : null,
    batches: batches.map((b) => ({
      id: b.id,
      batchNo: b.batchNo,
      source: b.source,
      lcId: b.lcId,
      lcNumber: lcs.find((l) => l.id === b.lcId)?.lcNumber ?? null,
      branchName: branches.get(b.branchId)?.name ?? "—",
      receivedAt: b.receivedAt.toISOString(),
      qtyReceived: num(b.qtyReceived),
      qtyAvailable: num(b.qtyAvailable),
      unitCost: showCost ? num(b.unitCost) : null,
    })),
    ledgerTotal,
    ledger: ledger.map((l) => ({
      id: l.id,
      at: l.createdAt.toISOString(),
      type: l.type,
      branchName: branches.get(l.branchId)?.name ?? "—",
      quantity: num(l.quantity),
      balanceAfter: num(l.balanceAfter),
      unitCost: showCost ? num(l.unitCost) : null,
      ref: ref(l.refType, l.refId),
      note: l.note,
      user: users.find((u) => u.id === l.createdById)?.name ?? null,
    })),
  }
}
export type StockCard = NonNullable<Awaited<ReturnType<typeof stockCard>>>

// ───────────────────────────── Adjustments & transfers lists ─────────────────────────────

export const ADJ_SORTABLE = ["date", "number", "createdAt"]

export async function listAdjustments(
  ctx: TenantContext,
  a: { q?: string; branchId?: string; reason?: string; from?: string; to?: string; sort: string; skip: number; take: number },
) {
  const [field, dir] = a.sort.split(":") as [string, "asc" | "desc"]
  const reasons = ADJUSTMENT_REASONS.map((r) => r.value) as string[]
  const where: Prisma.StockAdjustmentWhereInput = {
    companyId: ctx.companyId,
    ...branchFilter(ctx, a.branchId),
    ...(a.reason && reasons.includes(a.reason) ? { reason: a.reason as Prisma.EnumAdjustmentReasonFilter["equals"] } : {}),
    ...(a.q ? { OR: [{ number: { contains: a.q } }, { note: { contains: a.q } }] } : {}),
    ...(dateOnlyRange(a.from, a.to) ? { date: dateOnlyRange(a.from, a.to) } : {}),
  }
  const showCost = can(ctx, "inventory.view_cost")
  const [rows, total, branches] = await Promise.all([
    prisma.stockAdjustment.findMany({ where, orderBy: [{ [field]: dir }, { createdAt: "desc" }], skip: a.skip, take: a.take, include: { lines: true } }),
    prisma.stockAdjustment.count({ where }),
    branchMap(prisma, ctx.companyId),
  ])
  return {
    total,
    showCost,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: isoDate(r.date)!,
      branchName: branches.get(r.branchId)?.name ?? "—",
      reason: r.reason,
      note: r.note,
      lines: r.lines.length,
      unitsIn: num(sum(r.lines.filter((l) => l.quantity.gt(0)).map((l) => l.quantity))),
      unitsOut: num(sum(r.lines.filter((l) => l.quantity.lt(0)).map((l) => l.quantity.abs()))),
      value: showCost ? num(round2(sum(r.lines.map((l) => l.quantity.times(l.unitCost))))) : null,
    })),
  }
}
export type AdjustmentRow = Awaited<ReturnType<typeof listAdjustments>>["rows"][number]

export const TRF_SORTABLE = ["date", "number", "createdAt"]

export async function listTransfers(
  ctx: TenantContext,
  a: { q?: string; branchId?: string; status?: string; direction?: string; from?: string; to?: string; sort: string; skip: number; take: number },
) {
  const [field, dir] = a.sort.split(":") as [string, "asc" | "desc"]
  let scope: Prisma.StockTransferWhereInput
  if (a.branchId && a.branchId !== "all") {
    if (!ctx.branchIds.includes(a.branchId)) throw forbidden("You do not have access to this branch")
    scope =
      a.direction === "out"
        ? { fromBranchId: a.branchId }
        : a.direction === "in"
          ? { toBranchId: a.branchId }
          : { OR: [{ fromBranchId: a.branchId }, { toBranchId: a.branchId }] }
  } else {
    scope =
      a.direction === "out"
        ? { fromBranchId: { in: ctx.branchIds } }
        : a.direction === "in"
          ? { toBranchId: { in: ctx.branchIds } }
          : { OR: [{ fromBranchId: { in: ctx.branchIds } }, { toBranchId: { in: ctx.branchIds } }] }
  }
  const where: Prisma.StockTransferWhereInput = {
    companyId: ctx.companyId,
    AND: [scope, ...(a.q ? [{ OR: [{ number: { contains: a.q } }, { note: { contains: a.q } }] }] : [])],
    ...(a.status && ["pending", "completed", "cancelled"].includes(a.status) ? { status: a.status as "pending" } : {}),
    ...(dateOnlyRange(a.from, a.to) ? { date: dateOnlyRange(a.from, a.to) } : {}),
  }
  const showCost = can(ctx, "inventory.view_cost")
  const [rows, total, branches] = await Promise.all([
    prisma.stockTransfer.findMany({ where, orderBy: [{ [field]: dir }, { createdAt: "desc" }], skip: a.skip, take: a.take, include: { lines: true } }),
    prisma.stockTransfer.count({ where }),
    branchMap(prisma, ctx.companyId),
  ])
  return {
    total,
    showCost,
    rows: rows.map((t) => ({
      id: t.id,
      number: t.number,
      date: isoDate(t.date)!,
      fromName: branches.get(t.fromBranchId)?.name ?? "—",
      toName: branches.get(t.toBranchId)?.name ?? "—",
      status: t.status,
      lines: t.lines.length,
      units: num(sum(t.lines.map((l) => l.quantity))),
      value: showCost ? num(round2(sum(t.lines.map((l) => l.quantity.times(l.unitCost))))) : null,
      awaitingYou: t.status === "pending" && ctx.branchIds.includes(t.toBranchId),
    })),
  }
}
export type TransferRow = Awaited<ReturnType<typeof listTransfers>>["rows"][number]

/** Variation ids → info, re-exported for pages. */
export { variationInfo }
