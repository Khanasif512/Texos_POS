import "server-only"
import { prisma, type TenantDb } from "@/server/db"
import { AppError, businessRule, forbidden, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import { assertBranch, can, type TenantContext } from "@/server/auth/context"
import { dec, num, round2, round4 } from "@/server/decimal"
import { postSupplierLedger } from "@/server/modules/ledger/service"
import type { Prisma } from "@/generated/prisma/client"
import {
  canCalculate,
  LC_COST_TYPE_LABEL,
  LC_STATUS_LABEL,
  lcLockedSchema,
  lcSchema,
  lcStatusIndex,
  linesEditable,
  type CalculationOutput,
  type CostItemOutput,
  type LcCostType,
  type LcOutput,
  type LcStatus,
} from "@/lib/validation/lc"
import { calculateLandedCost, LcEngineError, lineBreakdown, type DistributionBasis, type EngineResult } from "./engine"

type Tx = Prisma.TransactionClient

/** Cost figures (LC value, cost sheet, landed cost) are visible to costing roles only. */
export const canSeeLcCost = (ctx: TenantContext) => can(ctx, "inventory.view_cost") || can(ctx, "lc.update") || can(ctx, "lc.finalize")

const toDate = (s: string | null | undefined) => (s ? new Date(s) : null)
const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const today = () => new Date(new Date().toISOString().slice(0, 10))

// ───────── Loading ─────────

async function findLc(ctx: TenantContext, db: TenantDb, id: string) {
  const lc = await db.lc.findFirst({
    where: { id },
    include: { lines: { orderBy: { createdAt: "asc" } }, costItems: { orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }] } },
  })
  if (!lc || !ctx.branchIds.includes(lc.branchId)) throw notFound("LC")
  return lc
}

async function variationInfo(db: TenantDb, ids: string[]) {
  const rows = await db.productVariation.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true, sku: true, unitWeight: true, product: { select: { name: true, unit: true } } },
  })
  return new Map(rows.map((v) => [v.id, v]))
}

/** Snapshot copy of the cost items (LC-06 calculation trail). */
type CostItemCopy = { id: string; costType: string; amount: string; description: string | null; entryDate: string | null; sourceType: string }
const copyCostItems = (items: { id: string; costType: string; amount: Prisma.Decimal; description: string | null; entryDate: Date; sourceType: string }[]): CostItemCopy[] =>
  items.map((c) => ({
    id: c.id,
    costType: c.costType,
    amount: dec(c.amount).toFixed(2),
    description: c.description,
    entryDate: isoDay(c.entryDate),
    sourceType: c.sourceType,
  }))

const costSignature = (items: { id: string; costType: string; amount: Prisma.Decimal | string | number }[]) =>
  items
    .map((c) => `${c.id}:${c.costType}:${dec(c.amount).toFixed(2)}`)
    .sort()
    .join("|")

/** LC-07: have cost items or the rate changed since the current snapshot? */
export function costsChangedSince(
  lc: { exchangeRate: Prisma.Decimal; distributionBasis: string; costItems: { id: string; costType: string; amount: Prisma.Decimal }[] },
  snapshot: { exchangeRate: Prisma.Decimal; basis: string; costItems: unknown } | null,
) {
  if (!snapshot) return { changed: false, basisDiffers: false }
  const snapItems = Array.isArray(snapshot.costItems) ? (snapshot.costItems as CostItemCopy[]) : []
  return {
    changed: costSignature(lc.costItems) !== costSignature(snapItems) || !dec(lc.exchangeRate).eq(dec(snapshot.exchangeRate)),
    basisDiffers: lc.distributionBasis !== snapshot.basis,
  }
}

const engineInput = (
  lc: { exchangeRate: Prisma.Decimal; lines: { id: string; variationId: string; quantity: Prisma.Decimal; unitWeight: Prisma.Decimal; unitPriceForeign: Prisma.Decimal }[]; costItems: { id: string; costType: string; amount: Prisma.Decimal }[] },
  basis: DistributionBasis,
) => ({
  basis,
  exchangeRate: lc.exchangeRate,
  lines: lc.lines.map((l) => ({ lcLineId: l.id, variationId: l.variationId, quantity: l.quantity, unitWeight: l.unitWeight, unitPriceForeign: l.unitPriceForeign })),
  costItems: lc.costItems.map((c) => ({ id: c.id, costType: c.costType, amount: c.amount })),
})

function runEngine(input: Parameters<typeof calculateLandedCost>[0]) {
  try {
    return calculateLandedCost(input)
  } catch (e) {
    if (e instanceof LcEngineError) throw businessRule(e.message, { code: e.code })
    throw e
  }
}

// ───────── List ─────────

export async function listLcs(
  ctx: TenantContext,
  db: TenantDb,
  p: { q?: string; status?: string; supplierId?: string; branchId?: string; skip: number; take: number; orderBy: Record<string, "asc" | "desc"> },
) {
  const branchIds = p.branchId && p.branchId !== "all" ? (assertBranch(ctx, p.branchId), [p.branchId]) : ctx.branchIds
  const where: Prisma.LcWhereInput = {
    branchId: { in: branchIds },
    ...(p.status && p.status !== "all" ? { status: p.status as LcStatus } : {}),
    ...(p.supplierId && p.supplierId !== "all" ? { supplierId: p.supplierId } : {}),
    ...(p.q
      ? { OR: [{ lcNumber: { contains: p.q } }, { issuingBank: { contains: p.q } }, { supplier: { name: { contains: p.q } } }] }
      : {}),
  }
  const [rows, total] = await Promise.all([
    db.lc.findMany({
      where,
      orderBy: p.orderBy,
      skip: p.skip,
      take: p.take,
      include: {
        supplier: { select: { id: true, name: true } },
        snapshots: { where: { isCurrent: true }, take: 1, select: { version: true, totalBaseCost: true, totalExtraCost: true } },
      },
    }),
    db.lc.count({ where }),
  ])
  const showCost = canSeeLcCost(ctx)
  const branchName = new Map(ctx.branches.map((b) => [b.id, b.name]))
  return {
    total,
    rows: rows.map((l) => {
      const snap = l.snapshots[0]
      return {
        id: l.id,
        lcNumber: l.lcNumber,
        supplierId: l.supplierId,
        supplierName: l.supplier.name,
        issuingBank: l.issuingBank,
        branchId: l.branchId,
        branchName: branchName.get(l.branchId) ?? "—",
        currency: l.currency,
        lcValue: showCost ? num(l.lcValue) : null,
        exchangeRate: num(l.exchangeRate),
        status: l.status as LcStatus,
        openedDate: isoDay(l.openedDate),
        expectedArrivalDate: isoDay(l.expectedArrivalDate),
        actualArrivalDate: isoDay(l.actualArrivalDate),
        landedTotal: showCost && snap ? num(dec(snap.totalBaseCost).plus(snap.totalExtraCost)) : null,
        snapshotVersion: snap?.version ?? null,
      }
    }),
  }
}
export type LcListRow = Awaited<ReturnType<typeof listLcs>>["rows"][number]

// ───────── Detail ─────────

export async function getLcDetail(ctx: TenantContext, db: TenantDb, id: string) {
  const lc = await findLc(ctx, db, id)
  const [supplier, branch, variations, snapshots] = await Promise.all([
    db.supplier.findFirst({ where: { id: lc.supplierId }, select: { id: true, code: true, name: true, country: true, currency: true } }),
    db.branch.findFirst({ where: { id: lc.branchId }, select: { id: true, name: true, code: true } }),
    variationInfo(db, lc.lines.map((l) => l.variationId)),
    db.landedCostSnapshot.findMany({ where: { lcId: id }, orderBy: { version: "desc" } }),
  ])
  const users = await prisma.user.findMany({
    where: { companyId: ctx.companyId, id: { in: snapshots.map((s) => s.createdById).filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  })
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const current = snapshots.find((s) => s.isCurrent) ?? null
  const currentLines = current ? await prisma.landedCostLine.findMany({ where: { snapshotId: current.id } }) : []
  const landed = new Map(currentLines.map((l) => [l.lcLineId, num(l.landedUnitCost)]))
  const showCost = canSeeLcCost(ctx)
  const { changed, basisDiffers } = costsChangedSince(lc, current)

  return {
    id: lc.id,
    lcNumber: lc.lcNumber,
    issuingBank: lc.issuingBank,
    currency: lc.currency as "RMB" | "USD",
    lcValue: showCost ? num(lc.lcValue) : 0,
    exchangeRate: num(lc.exchangeRate),
    distributionBasis: lc.distributionBasis as DistributionBasis,
    status: lc.status as LcStatus,
    openedDate: isoDay(lc.openedDate),
    expectedArrivalDate: isoDay(lc.expectedArrivalDate),
    actualArrivalDate: isoDay(lc.actualArrivalDate),
    finalizedAt: lc.finalizedAt?.toISOString() ?? null,
    notes: lc.notes,
    createdAt: lc.createdAt.toISOString(),
    showCost,
    supplier: supplier
      ? { ...supplier, currency: supplier.currency as string }
      : { id: lc.supplierId, code: "", name: "Unknown supplier", country: null, currency: lc.currency as string },
    branch: branch ?? { id: lc.branchId, name: "—", code: "" },
    lines: lc.lines.map((l) => {
      const v = variations.get(l.variationId)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: v?.product.name ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.product.unit ?? "pcs",
        defaultUnitWeight: num(v?.unitWeight),
        quantity: num(l.quantity),
        unitWeight: num(l.unitWeight),
        unitPriceForeign: showCost ? num(l.unitPriceForeign) : 0,
        lineValueForeign: showCost ? num(l.lineValueForeign) : 0,
        receivedQty: num(l.receivedQty),
        landedUnitCost: showCost ? (landed.get(l.id) ?? null) : null,
      }
    }),
    costItems: showCost
      ? lc.costItems.map((c) => ({
          id: c.id,
          costType: c.costType as LcCostType,
          amount: num(c.amount),
          description: c.description,
          entryDate: isoDay(c.entryDate)!,
          sourceType: c.sourceType,
          sourceId: c.sourceId,
        }))
      : [],
    snapshots: showCost
      ? snapshots.map((s) => ({
          id: s.id,
          version: s.version,
          basis: s.basis as DistributionBasis,
          exchangeRate: num(s.exchangeRate),
          totalBaseCost: num(s.totalBaseCost),
          totalExtraCost: num(s.totalExtraCost),
          reason: s.reason,
          isCurrent: s.isCurrent,
          createdAt: s.createdAt.toISOString(),
          createdBy: s.createdById ? (userName.get(s.createdById) ?? "—") : "—",
        }))
      : [],
    totals: (() => {
      const valueForeign = lc.lines.reduce((a, l) => a.plus(l.lineValueForeign), dec(0))
      const extra = lc.costItems.reduce((a, c) => a.plus(c.amount), dec(0))
      return {
        quantity: num(lc.lines.reduce((a, l) => a.plus(l.quantity), dec(0))),
        weight: num(lc.lines.reduce((a, l) => a.plus(dec(l.quantity).times(l.unitWeight)), dec(0))),
        valueForeign: showCost ? num(valueForeign) : 0,
        baseCost: showCost
          ? num(round2(lc.lines.reduce((a, l) => a.plus(dec(l.quantity).times(l.unitPriceForeign).times(lc.exchangeRate)), dec(0))))
          : 0,
        extraCost: showCost ? num(round2(extra)) : 0,
      }
    })(),
    hasReceipts: lc.lines.some((l) => dec(l.receivedQty).gt(0)),
    costsChanged: showCost && changed,
    basisDiffers: showCost && basisDiffers,
    preview: showCost ? buildPreview(lc) : null,
  }
}
export type LcDetail = Awaited<ReturnType<typeof getLcDetail>>

/** Serialisable engine result + per-line cost-item breakdown (acceptance criterion 3). */
function serializeResult(r: EngineResult, costItems: { id: string; costType: string; amount: Prisma.Decimal; description: string | null }[]) {
  const n = (v: { toFixed(dp: number): string }, dp: number) => Number(v.toFixed(dp))
  return {
    basis: r.basis,
    totalQuantity: n(r.totalQuantity, 3),
    totalWeight: n(r.totalWeight, 4),
    totalValueForeign: n(r.totalValueForeign, 4),
    totalBaseCost: n(r.totalBaseCost, 2),
    totalExtraCost: n(r.totalExtraCost, 2),
    totalLandedCost: n(r.totalLandedCost, 2),
    warnings: r.warnings,
    lines: r.lines.map((l) => {
      const b = lineBreakdown(l, costItems.map((c) => ({ id: c.id, costType: c.costType, amount: c.amount })))
      return {
        lcLineId: l.lcLineId,
        quantity: n(l.quantity, 3),
        lineWeight: n(l.lineWeight, 4),
        ratio: n(l.ratio, 10),
        baseUnitCost: n(l.baseUnitCost, 4),
        baseTotal: n(l.baseTotal, 2),
        extraCostTotal: n(l.extraCostTotal, 2),
        extraUnitCost: n(l.extraUnitCost, 4),
        landedUnitCost: n(l.landedUnitCost, 4),
        landedTotal: n(l.landedTotal, 2),
        breakdown: b.items.map((i, idx) => ({
          costItemId: i.id ?? String(idx),
          costType: i.costType as LcCostType,
          description: costItems[idx]?.description ?? null,
          amount: n(i.amount, 2),
          lineAmount: n(i.lineAmount, 2),
          unitAmount: n(i.unitAmount, 4),
        })),
        rounding: n(b.rounding, 2),
      }
    }),
  }
}
export type SerializedResult = ReturnType<typeof serializeResult>
export type PreviewEntry = { ok: true; result: SerializedResult } | { ok: false; error: string }

/** Live preview for both bases, so users can compare before finalizing (LC-04 acceptance). */
export function buildPreview(lc: Parameters<typeof engineInput>[0] & { costItems: { id: string; costType: string; amount: Prisma.Decimal; description: string | null }[] }) {
  const one = (basis: DistributionBasis): PreviewEntry => {
    try {
      return { ok: true, result: serializeResult(calculateLandedCost(engineInput(lc, basis)), lc.costItems) }
    } catch (e) {
      if (e instanceof LcEngineError) return { ok: false, error: e.message }
      throw e
    }
  }
  return { weight: one("weight"), quantity: one("quantity") }
}

export async function getSnapshot(ctx: TenantContext, db: TenantDb, lcId: string, snapshotId: string) {
  const lc = await findLc(ctx, db, lcId)
  const snap = await db.landedCostSnapshot.findFirst({ where: { id: snapshotId, lcId } })
  if (!snap) throw notFound("Calculation")
  const lines = await prisma.landedCostLine.findMany({ where: { snapshotId } })
  const variations = await variationInfo(db, lines.map((l) => l.variationId))
  const order = new Map(lc.lines.map((l, i) => [l.id, i]))
  return {
    id: snap.id,
    version: snap.version,
    basis: snap.basis as DistributionBasis,
    exchangeRate: num(snap.exchangeRate),
    totalBaseCost: num(snap.totalBaseCost),
    totalExtraCost: num(snap.totalExtraCost),
    reason: snap.reason,
    isCurrent: snap.isCurrent,
    createdAt: snap.createdAt.toISOString(),
    costItems: (Array.isArray(snap.costItems) ? (snap.costItems as CostItemCopy[]) : []).map((c) => ({
      ...c,
      amount: Number(c.amount),
      label: LC_COST_TYPE_LABEL[c.costType as LcCostType] ?? c.costType,
    })),
    lines: lines
      .sort((a, b) => (order.get(a.lcLineId) ?? 99) - (order.get(b.lcLineId) ?? 99))
      .map((l) => {
        const v = variations.get(l.variationId)
        return {
          id: l.id,
          lcLineId: l.lcLineId,
          productName: v ? `${v.product.name} — ${v.name}` : "Unknown product",
          sku: v?.sku ?? "",
          quantity: num(l.quantity),
          unitWeight: num(l.unitWeight),
          ratio: num(l.ratio),
          baseUnitCost: num(l.baseUnitCost),
          extraCostTotal: num(l.extraCostTotal),
          extraUnitCost: num(l.extraUnitCost),
          landedUnitCost: num(l.landedUnitCost),
        }
      }),
  }
}
export type SnapshotDetail = Awaited<ReturnType<typeof getSnapshot>>

/**
 * For goods receipt (another module): landed unit cost per LC line from the current snapshot.
 * Throws if the LC is not yet receivable (LC-10: only Received or later).
 */
export async function currentLandedUnitCosts(tx: Tx, companyId: string, lcId: string) {
  const lc = await tx.lc.findFirst({ where: { id: lcId, companyId }, select: { status: true } })
  if (!lc) throw notFound("LC")
  if (!canCalculate(lc.status) && lc.status !== "closed") throw businessRule("Only LCs in Received or later status can be received into stock.")
  const snap = await tx.landedCostSnapshot.findFirst({ where: { lcId, companyId, isCurrent: true }, include: { lines: true } })
  if (!snap) throw businessRule("Save the landed-cost calculation for this LC before receiving goods.")
  return new Map(snap.lines.map((l) => [l.lcLineId, dec(l.landedUnitCost)]))
}

// ───────── Create / update / delete (LC-01) ─────────

async function checkRefs(ctx: TenantContext, db: TenantDb, input: LcOutput, selfId?: string) {
  assertBranch(ctx, input.branchId)
  const supplier = await db.supplier.findFirst({ where: { id: input.supplierId }, select: { id: true, status: true } })
  if (!supplier) throw new AppError("VALIDATION_ERROR", "Choose a valid supplier", { fields: { supplierId: "Invalid supplier" } })
  const ids = [...new Set(input.lines.map((l) => l.variationId))]
  const found = await db.productVariation.count({ where: { id: { in: ids } } })
  if (found !== ids.length) throw new AppError("VALIDATION_ERROR", "One or more products are invalid", { fields: { lines: "Invalid product" } })
  const dup = await db.lc.findFirst({ where: { lcNumber: input.lcNumber, ...(selfId ? { NOT: { id: selfId } } : {}) }, select: { id: true } })
  if (dup) throw new AppError("CONFLICT", "This LC number already exists", { fields: { lcNumber: "LC number already used" } })
}

const lineData = (companyId: string, l: LcOutput["lines"][number]) => ({
  companyId,
  variationId: l.variationId,
  quantity: dec(l.quantity),
  unitWeight: dec(l.unitWeight),
  unitPriceForeign: dec(l.unitPriceForeign),
  lineValueForeign: round4(dec(l.quantity).times(dec(l.unitPriceForeign))),
})

const headerData = (input: LcOutput) => ({
  supplierId: input.supplierId,
  lcNumber: input.lcNumber,
  issuingBank: input.issuingBank,
  branchId: input.branchId,
  currency: input.currency,
  lcValue: dec(input.lcValue),
  exchangeRate: dec(input.exchangeRate),
  distributionBasis: input.distributionBasis,
  openedDate: toDate(input.openedDate),
  expectedArrivalDate: toDate(input.expectedArrivalDate),
  actualArrivalDate: toDate(input.actualArrivalDate),
  notes: input.notes,
})

export async function createLc(ctx: TenantContext, db: TenantDb, input: LcOutput) {
  await checkRefs(ctx, db, input)
  return prisma.$transaction(async (tx) => {
    const lc = await tx.lc.create({
      data: {
        companyId: ctx.companyId,
        ...headerData(input),
        createdById: ctx.userId,
        lines: { create: input.lines.map((l) => lineData(ctx.companyId, l)) },
      },
      include: { lines: true },
    })
    await audit(ctx, { action: "create", entityType: "lc", entityId: lc.id, summary: `Created LC ${lc.lcNumber}`, after: lc }, tx)
    return lc
  })
}

/**
 * Before receipt everything is editable; afterwards only rate, basis, notes and actual arrival
 * date (cost items are edited separately). Closed LCs only accept notes.
 */
export async function updateLc(ctx: TenantContext, db: TenantDb, id: string, body: unknown) {
  const before = await findLc(ctx, db, id)
  if (linesEditable(before.status)) {
    const input = lcSchema.parse(body)
    await checkRefs(ctx, db, input, id)
    const keep = new Set(before.lines.map((l) => l.id))
    return prisma.$transaction(async (tx) => {
      const incomingIds = new Set(input.lines.map((l) => l.id).filter((x): x is string => !!x && keep.has(x)))
      await tx.lcProductLine.deleteMany({ where: { lcId: id, companyId: ctx.companyId, id: { notIn: [...incomingIds] } } })
      for (const l of input.lines) {
        if (l.id && incomingIds.has(l.id)) await tx.lcProductLine.update({ where: { id: l.id }, data: lineData(ctx.companyId, l) })
        else await tx.lcProductLine.create({ data: { ...lineData(ctx.companyId, l), lcId: id } })
      }
      const after = await tx.lc.update({ where: { id }, data: headerData(input), include: { lines: true } })
      await audit(ctx, { action: "update", entityType: "lc", entityId: id, summary: `Updated LC ${after.lcNumber}`, before, after }, tx)
      return after
    })
  }

  // partial bodies keep the stored values
  const input = lcLockedSchema.parse({
    exchangeRate: before.exchangeRate.toString(),
    distributionBasis: before.distributionBasis,
    notes: before.notes ?? "",
    actualArrivalDate: isoDay(before.actualArrivalDate),
    ...(body && typeof body === "object" ? body : {}),
  })
  const data =
    before.status === "closed"
      ? { notes: input.notes }
      : {
          exchangeRate: dec(input.exchangeRate),
          distributionBasis: input.distributionBasis,
          notes: input.notes,
          actualArrivalDate: toDate(input.actualArrivalDate) ?? before.actualArrivalDate,
        }
  if ("exchangeRate" in data && dec(data.exchangeRate).lte(0) && !dec(before.exchangeRate).lte(0))
    throw new AppError("VALIDATION_ERROR", "The exchange rate must be more than 0", { fields: { exchangeRate: "Must be more than 0" } })
  const after = await db.lc.update({ where: { id }, data })
  await audit(ctx, {
    action: "update",
    entityType: "lc",
    entityId: id,
    summary: `Updated LC ${after.lcNumber}${!dec(before.exchangeRate).eq(after.exchangeRate) ? ` (rate ${before.exchangeRate} → ${after.exchangeRate})` : ""}`,
    before: { exchangeRate: before.exchangeRate, distributionBasis: before.distributionBasis, notes: before.notes, actualArrivalDate: before.actualArrivalDate },
    after: { exchangeRate: after.exchangeRate, distributionBasis: after.distributionBasis, notes: after.notes, actualArrivalDate: after.actualArrivalDate },
  })
  return after
}

/** Only draft LCs without any calculation can be deleted. */
export async function deleteLc(ctx: TenantContext, db: TenantDb, id: string) {
  const lc = await findLc(ctx, db, id)
  if (lc.status !== "draft") throw businessRule("Only draft LCs can be deleted. Opened LCs are part of the financial record.")
  if (await db.landedCostSnapshot.count({ where: { lcId: id } })) throw businessRule("This LC has landed-cost calculations and cannot be deleted.")
  if (lc.costItems.some((c) => c.sourceType !== "manual"))
    throw businessRule("Expenses or delivery charges are allocated to this LC. Remove those allocations first.")
  await prisma.$transaction(async (tx) => {
    await tx.lc.delete({ where: { id } })
    await audit(ctx, { action: "delete", entityType: "lc", entityId: id, summary: `Deleted draft LC ${lc.lcNumber}`, before: lc }, tx)
  })
}

// ───────── Status workflow (LC-10) ─────────

const NEXT: Record<LcStatus, LcStatus | null> = {
  draft: "opened",
  opened: "goods_in_transit",
  goods_in_transit: "received",
  received: "cost_finalized",
  cost_finalized: "closed",
  closed: null,
}

export async function changeStatus(ctx: TenantContext, db: TenantDb, id: string, input: { status: LcStatus; date: string | null }) {
  const lc = await findLc(ctx, db, id)
  const from = lc.status as LcStatus
  const to = input.status
  if (from === to) throw businessRule(`The LC is already ${LC_STATUS_LABEL[to].toLowerCase()}.`)
  if (to === "cost_finalized" && from === "received")
    throw businessRule("Finalize the landed cost from the Landed cost tab — it saves the calculation and sets the status.")

  const forward = lcStatusIndex(to) > lcStatusIndex(from)
  const data: Prisma.LcUpdateInput = { status: to }
  if (forward) {
    if (NEXT[from] !== to)
      throw businessRule(`An LC moves step by step: ${LC_STATUS_LABEL[from]} can only move to ${NEXT[from] ? LC_STATUS_LABEL[NEXT[from]!] : "nothing"}.`)
    if (to === "opened") {
      if (!lc.lines.length) throw businessRule("Add at least one product line before opening the LC.")
      data.openedDate = toDate(input.date) ?? lc.openedDate ?? today()
    }
    if (to === "received") data.actualArrivalDate = toDate(input.date) ?? lc.actualArrivalDate ?? today()
    if (to === "closed" && !can(ctx, "lc.finalize")) throw forbidden("Closing an LC requires the finalize permission.")
  } else {
    // one step back, to correct a mistaken move
    if (NEXT[to] !== from) throw businessRule("An LC can only be moved back one step at a time.")
    if (from === "received") {
      if (await db.landedCostSnapshot.count({ where: { lcId: id } }))
        throw businessRule("Landed cost has already been calculated for this LC, so it cannot go back to transit.")
      if (lc.lines.some((l) => dec(l.receivedQty).gt(0))) throw businessRule("Goods have already been received into stock from this LC.")
      data.actualArrivalDate = null
    }
    if (from === "cost_finalized") throw businessRule("A finalized LC cannot be un-finalized. Correct costs and recalculate instead.")
    if (from === "closed" && !can(ctx, "lc.finalize")) throw forbidden("Reopening an LC requires the finalize permission.")
  }

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.lc.update({ where: { id }, data })
    await audit(
      ctx,
      {
        action: "update",
        entityType: "lc",
        entityId: id,
        summary: `LC ${lc.lcNumber}: ${LC_STATUS_LABEL[from]} → ${LC_STATUS_LABEL[to]}`,
        before: { status: from, openedDate: lc.openedDate, actualArrivalDate: lc.actualArrivalDate },
        after: { status: to, openedDate: updated.openedDate, actualArrivalDate: updated.actualArrivalDate },
      },
      tx,
    )
    return updated
  })
  return after
}

// ───────── Cost items (LC-02) ─────────

function assertCostsEditable(status: string) {
  if (status === "closed") throw businessRule("This LC is closed. Reopen it to correct costs.")
}

export async function addCostItem(ctx: TenantContext, db: TenantDb, lcId: string, input: CostItemOutput) {
  const lc = await findLc(ctx, db, lcId)
  assertCostsEditable(lc.status)
  return prisma.$transaction(async (tx) => {
    const item = await tx.lcCostItem.create({
      data: {
        companyId: ctx.companyId,
        lcId,
        costType: input.costType,
        amount: round2(input.amount),
        description: input.description,
        entryDate: new Date(input.entryDate),
        sourceType: "manual",
        createdById: ctx.userId,
      },
    })
    await audit(
      ctx,
      {
        action: "create",
        entityType: "lc_cost_item",
        entityId: item.id,
        summary: `LC ${lc.lcNumber}: added ${LC_COST_TYPE_LABEL[input.costType]} ৳${item.amount.toFixed(2)}`,
        after: item,
      },
      tx,
    )
    return item
  })
}

async function manualItem(ctx: TenantContext, db: TenantDb, lcId: string, itemId: string) {
  const lc = await findLc(ctx, db, lcId)
  const item = lc.costItems.find((c) => c.id === itemId)
  if (!item) throw notFound("Cost item")
  if (item.sourceType !== "manual")
    throw businessRule("This cost comes from an expense or delivery charge. Edit it in the Expenses module instead.")
  assertCostsEditable(lc.status)
  return { lc, item }
}

export async function updateCostItem(ctx: TenantContext, db: TenantDb, lcId: string, itemId: string, input: CostItemOutput) {
  const { lc, item: before } = await manualItem(ctx, db, lcId, itemId)
  return prisma.$transaction(async (tx) => {
    const after = await tx.lcCostItem.update({
      where: { id: itemId },
      data: { costType: input.costType, amount: round2(input.amount), description: input.description, entryDate: new Date(input.entryDate) },
    })
    await audit(
      ctx,
      {
        action: "update",
        entityType: "lc_cost_item",
        entityId: itemId,
        summary: `LC ${lc.lcNumber}: ${LC_COST_TYPE_LABEL[input.costType]} ৳${before.amount.toFixed(2)} → ৳${after.amount.toFixed(2)}`,
        before,
        after,
      },
      tx,
    )
    return after
  })
}

export async function deleteCostItem(ctx: TenantContext, db: TenantDb, lcId: string, itemId: string) {
  const { lc, item } = await manualItem(ctx, db, lcId, itemId)
  await prisma.$transaction(async (tx) => {
    await tx.lcCostItem.delete({ where: { id: itemId } })
    await audit(
      ctx,
      {
        action: "delete",
        entityType: "lc_cost_item",
        entityId: itemId,
        summary: `LC ${lc.lcNumber}: removed ${LC_COST_TYPE_LABEL[item.costType as LcCostType]} ৳${item.amount.toFixed(2)}`,
        before: item,
      },
      tx,
    )
  })
}

// ───────── Landed-cost calculation, finalization, corrections (LC-04 … LC-07) ─────────

/**
 * FIN-03: the LC's product value (BDT) is payable to the supplier once finalized.
 * Posts the difference between the new base cost and what is already on the supplier ledger
 * for this LC — a credit on the first finalization or when the value rises, a debit adjustment when it falls.
 */
async function syncSupplierPayable(tx: Tx, ctx: TenantContext, lc: { id: string; lcNumber: string; supplierId: string }, totalBaseCost: string, version: number) {
  const agg = await tx.supplierLedgerEntry.aggregate({
    where: { companyId: ctx.companyId, supplierId: lc.supplierId, refType: "lc", refId: lc.id, type: { in: ["purchase", "adjustment"] } },
    _sum: { credit: true, debit: true },
  })
  const posted = dec(agg._sum.credit).minus(dec(agg._sum.debit))
  const diff = round2(dec(totalBaseCost).minus(posted))
  if (diff.isZero()) return null
  const first = posted.isZero() && agg._sum.credit == null
  await postSupplierLedger(tx, {
    companyId: ctx.companyId,
    supplierId: lc.supplierId,
    type: diff.gt(0) ? "purchase" : "adjustment",
    credit: diff.gt(0) ? diff : 0,
    debit: diff.lt(0) ? diff.abs() : 0,
    refType: "lc",
    refId: lc.id,
    note: first ? `LC ${lc.lcNumber} product value (v${version})` : `LC ${lc.lcNumber} value revised in v${version}`,
    userId: ctx.userId,
  })
  return { posted: posted.toFixed(2), diff: diff.toFixed(2) }
}

/**
 * LC-07: remaining stock from this LC takes the new landed cost. Units already sold keep the
 * cost snapshotted on their invoice lines — invoices are never touched.
 */
async function revalueBatches(tx: Tx, ctx: TenantContext, lc: { id: string; lines: { id: string; variationId: string }[] }, landed: Map<string, string>) {
  const batches = await tx.inventoryBatch.findMany({ where: { companyId: ctx.companyId, lcId: lc.id, qtyAvailable: { gt: 0 } } })
  if (!batches.length) return []
  const receiptLineIds = batches.map((b) => b.receiptLineId).filter((x): x is string => !!x)
  const grLines = receiptLineIds.length
    ? await tx.goodsReceiptLine.findMany({ where: { id: { in: receiptLineIds } }, select: { id: true, lcLineId: true } })
    : []
  const lcLineOf = new Map(grLines.map((g) => [g.id, g.lcLineId]))
  const changes: { batchId: string; batchNo: string; branchId: string; qtyAvailable: string; before: string; after: string }[] = []
  for (const b of batches) {
    let lcLineId = b.receiptLineId ? lcLineOf.get(b.receiptLineId) : null
    if (!lcLineId) {
      // e.g. a transferred batch without a receipt line: match by product when it is unambiguous
      const same = lc.lines.filter((l) => l.variationId === b.variationId)
      if (same.length === 1) lcLineId = same[0].id
    }
    const next = lcLineId ? landed.get(lcLineId) : undefined
    if (!next || dec(next).eq(b.unitCost)) continue
    await tx.inventoryBatch.update({ where: { id: b.id }, data: { unitCost: dec(next) } })
    changes.push({ batchId: b.id, batchNo: b.batchNo, branchId: b.branchId, qtyAvailable: b.qtyAvailable.toString(), before: b.unitCost.toFixed(4), after: next })
  }
  return changes
}

export async function saveCalculation(ctx: TenantContext, lcId: string, input: CalculationOutput, opts: { finalize: boolean }) {
  return prisma.$transaction(
    async (tx) => {
      // serialise concurrent calculations of the same LC (version numbers, ledger diff)
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM lcs WHERE id = ${lcId} AND companyId = ${ctx.companyId} FOR UPDATE`
      if (!locked.length) throw notFound("LC")
      const lc = await tx.lc.findFirst({
        where: { id: lcId, companyId: ctx.companyId },
        include: {
          lines: { orderBy: { createdAt: "asc" } },
          costItems: { orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }] },
          snapshots: { where: { isCurrent: true }, take: 1 },
        },
      })
      if (!lc || !ctx.branchIds.includes(lc.branchId)) throw notFound("LC")
      if (opts.finalize) {
        if (lc.status === "cost_finalized") throw businessRule("This LC is already finalized. Use Recalculate to record a correction.")
        if (lc.status !== "received") throw businessRule("Mark the LC as received before finalizing its landed cost.")
      } else if (!canCalculate(lc.status)) {
        throw businessRule(
          lc.status === "closed" ? "This LC is closed. Reopen it to recalculate." : "Landed cost can be calculated once the LC is marked as received.",
        )
      }
      const current = lc.snapshots[0] ?? null
      if (lc.status === "cost_finalized" && !input.reason)
        throw new AppError("VALIDATION_ERROR", "Give a reason for this correction", { fields: { reason: "A reason is required after finalization" } })

      const result = runEngine(engineInput(lc, input.basis))
      const max = await tx.landedCostSnapshot.aggregate({ where: { lcId, companyId: ctx.companyId }, _max: { version: true } })
      const version = (max._max.version ?? 0) + 1
      await tx.landedCostSnapshot.updateMany({ where: { lcId, companyId: ctx.companyId, isCurrent: true }, data: { isCurrent: false } })
      const reason = input.reason ?? (opts.finalize ? "Finalized" : current ? "Recalculated" : "Initial calculation")
      const snapshot = await tx.landedCostSnapshot.create({
        data: {
          companyId: ctx.companyId,
          lcId,
          version,
          basis: input.basis,
          exchangeRate: dec(result.exchangeRate.toFixed(6)),
          totalBaseCost: dec(result.totalBaseCost.toFixed(2)),
          totalExtraCost: dec(result.totalExtraCost.toFixed(2)),
          costItems: copyCostItems(lc.costItems),
          reason,
          isCurrent: true,
          createdById: ctx.userId,
          lines: {
            create: result.lines.map((l) => ({
              lcLineId: l.lcLineId,
              variationId: l.variationId,
              quantity: dec(l.quantity.toFixed(3)),
              unitWeight: dec(l.unitWeight.toFixed(4)),
              ratio: dec(l.ratio.toFixed(10)),
              baseUnitCost: dec(l.baseUnitCost.toFixed(4)),
              extraCostTotal: dec(l.extraCostTotal.toFixed(2)),
              extraUnitCost: dec(l.extraUnitCost.toFixed(4)),
              landedUnitCost: dec(l.landedUnitCost.toFixed(4)),
            })),
          },
        },
      })

      const status = opts.finalize ? "cost_finalized" : lc.status
      await tx.lc.update({
        where: { id: lcId },
        data: { distributionBasis: input.basis, ...(opts.finalize ? { status: "cost_finalized", finalizedAt: new Date() } : {}) },
      })

      const payable = status === "cost_finalized" ? await syncSupplierPayable(tx, ctx, lc, result.totalBaseCost.toFixed(2), version) : null
      const landed = new Map(result.lines.map((l) => [l.lcLineId, l.landedUnitCost.toFixed(4)]))
      const revalued = await revalueBatches(tx, ctx, lc, landed)

      await audit(
        ctx,
        {
          action: opts.finalize ? "finalize" : "update",
          entityType: "lc",
          entityId: lcId,
          summary: `LC ${lc.lcNumber}: ${opts.finalize ? "finalized" : "recalculated"} landed cost v${version} (${input.basis} basis) — ${reason}`,
          before: current
            ? { version: current.version, basis: current.basis, exchangeRate: current.exchangeRate, totalBaseCost: current.totalBaseCost, totalExtraCost: current.totalExtraCost, status: lc.status }
            : { status: lc.status },
          after: {
            version,
            basis: input.basis,
            exchangeRate: result.exchangeRate.toFixed(6),
            totalBaseCost: result.totalBaseCost.toFixed(2),
            totalExtraCost: result.totalExtraCost.toFixed(2),
            status,
            lines: result.lines.map((l) => ({ lcLineId: l.lcLineId, landedUnitCost: l.landedUnitCost.toFixed(4) })),
            supplierPayable: payable,
          },
        },
        tx,
      )
      if (revalued.length)
        await audit(
          ctx,
          {
            action: "update",
            entityType: "inventory_batch",
            entityId: lcId,
            summary: `LC ${lc.lcNumber}: revalued ${revalued.length} stock batch(es) to landed cost v${version}`,
            before: revalued.map((r) => ({ batchId: r.batchId, batchNo: r.batchNo, unitCost: r.before, qtyAvailable: r.qtyAvailable })),
            after: revalued.map((r) => ({ batchId: r.batchId, batchNo: r.batchNo, unitCost: r.after, qtyAvailable: r.qtyAvailable })),
          },
          tx,
        )

      return {
        snapshotId: snapshot.id,
        version,
        status,
        basis: input.basis,
        totalBaseCost: result.totalBaseCost.toFixed(2),
        totalExtraCost: result.totalExtraCost.toFixed(2),
        lines: result.lines.map((l) => ({ lcLineId: l.lcLineId, landedUnitCost: l.landedUnitCost.toFixed(4) })),
        revaluedBatches: revalued.length,
        supplierPayable: payable,
      }
    },
    { timeout: 30_000 },
  )
}
