import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { branchFilter, can, type TenantContext } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { num, sum } from "@/server/decimal"
import { branchMap, isoDate } from "@/server/modules/inventory-ops/shared"

type ListArgs = { q?: string; status?: string; branchId?: string; from?: string; to?: string; skip: number; take: number; sort: string }

const dateOnlyRange = (from?: string, to?: string) => {
  if (!from && !to) return undefined
  const r: { gte?: Date; lte?: Date } = {}
  if (from) r.gte = new Date(`${from}T00:00:00.000Z`)
  if (to) r.lte = new Date(`${to}T00:00:00.000Z`)
  return r
}

export const PO_SORTABLE = ["orderDate", "number", "totalBdt", "createdAt"]

export async function listPurchaseOrders(ctx: TenantContext, a: ListArgs) {
  const [field, dir] = a.sort.split(":") as [string, "asc" | "desc"]
  const where: Prisma.PurchaseOrderWhereInput = {
    companyId: ctx.companyId,
    ...branchFilter(ctx, a.branchId),
    ...(a.status && ["pending", "partially_received", "received", "cancelled"].includes(a.status)
      ? { status: a.status as Prisma.EnumPurchaseOrderStatusFilter["equals"] }
      : a.status === "open"
        ? { status: { in: ["pending", "partially_received"] } }
        : {}),
    ...(a.q ? { OR: [{ number: { contains: a.q } }, { supplier: { name: { contains: a.q } } }] } : {}),
    ...(dateOnlyRange(a.from, a.to) ? { orderDate: dateOnlyRange(a.from, a.to) } : {}),
  }
  const [rows, total, branches] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ [field]: dir }, { createdAt: "desc" }],
      skip: a.skip,
      take: a.take,
      include: { supplier: { select: { name: true } }, lines: { select: { quantity: true, receivedQty: true, cancelledQty: true } } },
    }),
    prisma.purchaseOrder.count({ where }),
    branchMap(prisma, ctx.companyId),
  ])
  const showCost = can(ctx, "inventory.view_cost") || can(ctx, "purchase.create") || can(ctx, "purchase.update")
  return {
    total,
    showCost,
    rows: rows.map((p) => {
      const ordered = sum(p.lines.map((l) => l.quantity))
      const received = sum(p.lines.map((l) => l.receivedQty))
      return {
        id: p.id,
        number: p.number,
        supplierName: p.supplier.name,
        branchName: branches.get(p.branchId)?.name ?? "—",
        orderDate: isoDate(p.orderDate)!,
        expectedDate: isoDate(p.expectedDate),
        currency: p.currency,
        totalBdt: showCost ? num(p.totalBdt) : null,
        status: p.status,
        lineCount: p.lines.length,
        progress: ordered.gt(0) ? Math.min(100, Math.round(num(received.div(ordered).times(100)))) : 0,
        lcLinked: !!p.lcId,
      }
    }),
  }
}
export type PurchaseOrderRow = Awaited<ReturnType<typeof listPurchaseOrders>>["rows"][number]

export const GRN_SORTABLE = ["date", "number", "createdAt"]

export async function listGoodsReceipts(ctx: TenantContext, a: ListArgs & { source?: string }) {
  const [field, dir] = a.sort.split(":") as [string, "asc" | "desc"]
  let refIds: { poIds: string[]; lcIds: string[] } | null = null
  if (a.q) {
    // search GRN number, PO number, LC number or supplier name
    const [pos, lcs] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { companyId: ctx.companyId, OR: [{ number: { contains: a.q } }, { supplier: { name: { contains: a.q } } }] },
        select: { id: true },
        take: 200,
      }),
      prisma.lc.findMany({
        where: { companyId: ctx.companyId, OR: [{ lcNumber: { contains: a.q } }, { supplier: { name: { contains: a.q } } }] },
        select: { id: true },
        take: 200,
      }),
    ])
    refIds = { poIds: pos.map((p) => p.id), lcIds: lcs.map((l) => l.id) }
  }
  const where: Prisma.GoodsReceiptWhereInput = {
    companyId: ctx.companyId,
    ...branchFilter(ctx, a.branchId),
    ...(a.source === "po" ? { poId: { not: null } } : a.source === "lc" ? { lcId: { not: null } } : {}),
    ...(refIds ? { OR: [{ number: { contains: a.q } }, { poId: { in: refIds.poIds } }, { lcId: { in: refIds.lcIds } }] } : {}),
    ...(dateOnlyRange(a.from, a.to) ? { date: dateOnlyRange(a.from, a.to) } : {}),
  }
  const [rows, total, branches] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      orderBy: [{ [field]: dir }, { createdAt: "desc" }],
      skip: a.skip,
      take: a.take,
      include: { lines: { select: { quantity: true, unitCost: true } } },
    }),
    prisma.goodsReceipt.count({ where }),
    branchMap(prisma, ctx.companyId),
  ])
  const poIds = rows.flatMap((r) => (r.poId ? [r.poId] : []))
  const lcIds = rows.flatMap((r) => (r.lcId ? [r.lcId] : []))
  const [pos, lcs] = await Promise.all([
    poIds.length
      ? prisma.purchaseOrder.findMany({ where: { companyId: ctx.companyId, id: { in: poIds } }, select: { id: true, number: true, supplier: { select: { name: true } } } })
      : [],
    lcIds.length
      ? prisma.lc.findMany({ where: { companyId: ctx.companyId, id: { in: lcIds } }, select: { id: true, lcNumber: true, supplier: { select: { name: true } } } })
      : [],
  ])
  const poMap = new Map(pos.map((p) => [p.id, p]))
  const lcMap = new Map(lcs.map((l) => [l.id, l]))
  const showCost = can(ctx, "inventory.view_cost")
  return {
    total,
    showCost,
    rows: rows.map((r) => {
      const po = r.poId ? poMap.get(r.poId) : undefined
      const lc = r.lcId ? lcMap.get(r.lcId) : undefined
      return {
        id: r.id,
        number: r.number,
        date: isoDate(r.date)!,
        branchName: branches.get(r.branchId)?.name ?? "—",
        source: (r.lcId ? "lc" : "po") as "lc" | "po",
        sourceNumber: po?.number ?? lc?.lcNumber ?? "—",
        sourceId: r.poId ?? r.lcId,
        supplierName: po?.supplier.name ?? lc?.supplier.name ?? "—",
        quantity: num(sum(r.lines.map((l) => l.quantity))),
        value: showCost ? num(sum(r.lines.map((l) => l.quantity.times(l.unitCost))).toDecimalPlaces(2)) : null,
      }
    }),
  }
}
export type GoodsReceiptRow = Awaited<ReturnType<typeof listGoodsReceipts>>["rows"][number]

/** Open sources for the receive chooser: POs not fully received, LCs ready to receive. */
export async function openReceiptSources(ctx: TenantContext) {
  const [pos, lcs, branches] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { companyId: ctx.companyId, branchId: { in: ctx.branchIds }, status: { in: ["pending", "partially_received"] } },
      orderBy: { orderDate: "desc" },
      take: 50,
      include: { supplier: { select: { name: true } } },
    }),
    ctx.plan.features.lc
      ? prisma.lc.findMany({
          where: { companyId: ctx.companyId, status: { in: ["received", "cost_finalized"] } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: {
            supplier: { select: { name: true } },
            lines: { select: { quantity: true, receivedQty: true } },
            snapshots: { where: { isCurrent: true }, select: { id: true }, take: 1 },
          },
        })
      : [],
    branchMap(prisma, ctx.companyId),
  ])
  return {
    pos: pos.map((p) => ({
      id: p.id,
      number: p.number,
      supplierName: p.supplier.name,
      branchName: branches.get(p.branchId)?.name ?? "—",
      orderDate: isoDate(p.orderDate)!,
      status: p.status,
    })),
    lcs: lcs
      .map((l) => ({
        id: l.id,
        lcNumber: l.lcNumber,
        supplierName: l.supplier.name,
        branchName: branches.get(l.branchId)?.name ?? "—",
        status: l.status,
        hasSnapshot: l.snapshots.length > 0,
        open: l.lines.some((x) => x.quantity.gt(x.receivedQty)),
      }))
      .filter((l) => l.open),
  }
}
