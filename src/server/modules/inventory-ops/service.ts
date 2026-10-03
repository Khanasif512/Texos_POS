import "server-only"
import { randomUUID } from "node:crypto"
import type { Prisma } from "@/generated/prisma/client"
import { audit } from "@/server/audit"
import { assertBranch, assertFeature, can, type TenantContext } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { dec, num, round2, round4, sum } from "@/server/decimal"
import { businessRule, forbidden, notFound } from "@/server/errors"
import { nextNumber } from "@/server/modules/common/sequence"
import { issueStockFIFO, lastUnitCost, receiveStock } from "@/server/modules/inventory/stock"
import { ADJUSTMENT_REASONS, type AdjustmentOutput, type OpeningStockOutput, type TransferOutput } from "@/lib/validation/inventory"
import { mergeLines, splitAdjustment, transferActions, transferProblem, type TransferStatus } from "./calc"
import { assertVariations, branchMap, isoDate, movementTime, scopedBranch, toDateOnly, variationInfo } from "./shared"

const TX_OPTS = { timeout: 60_000 }
const reasonLabel = (r: string) => ADJUSTMENT_REASONS.find((x) => x.value === r)?.label ?? r

// ───────────────────────────── Adjustments (INV-05) ─────────────────────────────

export async function createAdjustment(ctx: TenantContext, input: AdjustmentOutput) {
  assertBranch(ctx, input.branchId)
  const branch = scopedBranch(ctx, input.branchId)
  const vars = await assertVariations(prisma, ctx.companyId, input.lines.map((l) => l.variationId))
  const at = movementTime(input.date)
  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "ADJ", branchId: branch.id, branchCode: branch.code, date: at })
    const adj = await tx.stockAdjustment.create({
      data: { companyId: ctx.companyId, branchId: branch.id, number, reason: input.reason, note: input.note, date: toDateOnly(input.date), createdById: ctx.userId },
    })
    const ref = { refType: "adjustment", refId: adj.id, userId: ctx.userId, note: `${reasonLabel(input.reason)}${input.note ? `: ${input.note}` : ""}`.slice(0, 255) }
    const { ins, outs } = splitAdjustment(input.lines)
    let valueIn = dec(0)
    let valueOut = dec(0)
    // removals first so a correction can't consume stock it just added
    for (const l of outs) {
      const qty = dec(l.quantity).abs()
      const r = await issueStockFIFO(tx, {
        ...ref,
        companyId: ctx.companyId,
        branchId: branch.id,
        variationId: l.variationId,
        quantity: qty,
        type: "adjustment_out",
        label: vars.get(l.variationId)?.label,
      })
      await tx.stockAdjustmentLine.create({ data: { adjustmentId: adj.id, variationId: l.variationId, quantity: qty.negated(), unitCost: r.unitCost } })
      valueOut = valueOut.plus(r.totalCost)
    }
    for (const l of ins) {
      const qty = dec(l.quantity)
      const unitCost = l.unitCost != null ? round4(l.unitCost) : await lastUnitCost(tx, ctx.companyId, branch.id, l.variationId)
      await receiveStock(tx, {
        ...ref,
        companyId: ctx.companyId,
        branchId: branch.id,
        variationId: l.variationId,
        quantity: qty,
        unitCost,
        source: "adjustment",
        type: "adjustment_in",
        batchNo: number,
        receivedAt: at,
      })
      await tx.stockAdjustmentLine.create({ data: { adjustmentId: adj.id, variationId: l.variationId, quantity: qty, unitCost } })
      valueIn = valueIn.plus(qty.times(unitCost))
    }
    await audit(
      ctx,
      {
        action: "create",
        entityType: "stock_adjustment",
        entityId: adj.id,
        summary: `Stock adjustment ${number} (${reasonLabel(input.reason)}) at ${branch.name}: +৳${round2(valueIn).toFixed(2)} / −৳${round2(valueOut).toFixed(2)}`,
        after: { number, branchId: branch.id, reason: input.reason, note: input.note, lines: input.lines },
      },
      tx,
    )
    return { id: adj.id, number }
  }, TX_OPTS)
}

export async function getAdjustment(ctx: TenantContext, id: string) {
  const a = await prisma.stockAdjustment.findFirst({ where: { id, companyId: ctx.companyId }, include: { lines: true } })
  if (!a) return null
  assertBranch(ctx, a.branchId)
  const showCost = can(ctx, "inventory.view_cost")
  const [vars, branches, user] = await Promise.all([
    variationInfo(prisma, ctx.companyId, a.lines.map((l) => l.variationId)),
    branchMap(prisma, ctx.companyId),
    a.createdById ? prisma.user.findFirst({ where: { id: a.createdById, companyId: ctx.companyId }, select: { name: true } }) : null,
  ])
  return {
    id: a.id,
    number: a.number,
    reason: a.reason,
    reasonLabel: reasonLabel(a.reason),
    note: a.note,
    date: isoDate(a.date)!,
    branchName: branches.get(a.branchId)?.name ?? "—",
    createdBy: user?.name ?? null,
    createdAt: a.createdAt.toISOString(),
    showCost,
    netValue: showCost ? num(round2(sum(a.lines.map((l) => l.quantity.times(l.unitCost))))) : null,
    lines: a.lines.map((l) => {
      const v = vars.get(l.variationId)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: v?.productName ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.unit ?? "pcs",
        quantity: num(l.quantity),
        unitCost: showCost ? num(l.unitCost) : null,
        value: showCost ? num(round2(l.quantity.times(l.unitCost))) : null,
      }
    }),
  }
}
export type AdjustmentDetail = NonNullable<Awaited<ReturnType<typeof getAdjustment>>>

// ───────────────────────────── Opening stock ─────────────────────────────

export async function createOpeningStock(ctx: TenantContext, input: OpeningStockOutput) {
  assertBranch(ctx, input.branchId)
  const branch = scopedBranch(ctx, input.branchId)
  const vars = await assertVariations(prisma, ctx.companyId, input.lines.map((l) => l.variationId))
  const refId = randomUUID()
  const at = movementTime(input.date)
  return prisma.$transaction(async (tx) => {
    let value = dec(0)
    let units = dec(0)
    for (const l of input.lines) {
      const qty = dec(l.quantity)
      await receiveStock(tx, {
        companyId: ctx.companyId,
        branchId: branch.id,
        variationId: l.variationId,
        quantity: qty,
        unitCost: l.unitCost,
        source: "opening",
        type: "opening",
        batchNo: "OPENING",
        receivedAt: at,
        refType: "opening",
        refId,
        userId: ctx.userId,
        note: input.note ?? "Opening stock",
      })
      value = value.plus(qty.times(round4(l.unitCost)))
      units = units.plus(qty)
    }
    await audit(
      ctx,
      {
        action: "create",
        entityType: "opening_stock",
        entityId: refId,
        summary: `Opening stock at ${branch.name}: ${input.lines.length} item(s), ${units.toString()} units, ৳${round2(value).toFixed(2)}`,
        after: {
          branchId: branch.id,
          date: input.date,
          lines: input.lines.map((l) => ({ ...l, sku: vars.get(l.variationId)?.sku })),
        },
      },
      tx,
    )
    return { refId, lines: input.lines.length, units: units.toString(), value: round2(value).toString() }
  }, TX_OPTS)
}

/** Recent opening-stock entries (grouped by posting). */
export async function recentOpeningEntries(ctx: TenantContext, take = 15) {
  const groups = await prisma.stockLedgerEntry.groupBy({
    by: ["refId", "branchId"],
    where: { companyId: ctx.companyId, type: "opening", branchId: { in: ctx.branchIds } },
    _count: { _all: true },
    _sum: { quantity: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take,
  })
  const branches = await branchMap(prisma, ctx.companyId)
  const showCost = can(ctx, "inventory.view_cost")
  const values = showCost && groups.length
    ? await prisma.stockLedgerEntry.findMany({
        where: { companyId: ctx.companyId, type: "opening", refId: { in: groups.map((g) => g.refId!).filter(Boolean) } },
        select: { refId: true, quantity: true, unitCost: true },
      })
    : []
  return groups.map((g) => ({
    refId: g.refId ?? "",
    branchName: branches.get(g.branchId)?.name ?? "—",
    lines: g._count._all,
    units: num(g._sum.quantity),
    value: showCost ? num(round2(sum(values.filter((v) => v.refId === g.refId).map((v) => v.quantity.times(v.unitCost))))) : null,
    at: g._max.createdAt?.toISOString() ?? null,
  }))
}

// ───────────────────────────── Transfers ─────────────────────────────

async function activeBranchIds(companyId: string) {
  const rows = await prisma.branch.findMany({ where: { companyId, status: "active" }, select: { id: true } })
  return rows.map((b) => b.id)
}

/** Dispatch: issue FIFO from the source branch (transfer_out), snapshot weighted cost per line, status pending. */
export async function createTransfer(ctx: TenantContext, input: TransferOutput) {
  assertFeature(ctx, "multiBranchTransfer")
  const merged = mergeLines(input.lines)
  const problem = transferProblem(
    { ...input, lines: merged.map((l) => ({ variationId: l.variationId, quantity: l.qty.toString() })) },
    { userBranchIds: ctx.branchIds, activeBranchIds: await activeBranchIds(ctx.companyId) },
  )
  if (problem) throw businessRule(problem)
  const from = scopedBranch(ctx, input.fromBranchId)
  const vars = await assertVariations(prisma, ctx.companyId, merged.map((l) => l.variationId))
  const branches = await branchMap(prisma, ctx.companyId)
  const to = branches.get(input.toBranchId)!
  return prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "TRF", branchId: from.id, branchCode: from.code })
    const t = await tx.stockTransfer.create({
      data: {
        companyId: ctx.companyId,
        fromBranchId: from.id,
        toBranchId: to.id,
        number,
        status: "pending",
        date: toDateOnly(input.date),
        note: input.note,
        createdById: ctx.userId,
      },
    })
    let value = dec(0)
    for (const l of merged) {
      const r = await issueStockFIFO(tx, {
        companyId: ctx.companyId,
        branchId: from.id,
        variationId: l.variationId,
        quantity: l.qty.toString(),
        type: "transfer_out",
        label: vars.get(l.variationId)?.label,
        refType: "transfer",
        refId: t.id,
        userId: ctx.userId,
        note: `Transfer ${number} to ${to.name}`,
      })
      await tx.stockTransferLine.create({ data: { transferId: t.id, variationId: l.variationId, quantity: l.qty.toString(), unitCost: r.unitCost } })
      value = value.plus(r.totalCost)
    }
    await audit(
      ctx,
      {
        action: "create",
        entityType: "stock_transfer",
        entityId: t.id,
        summary: `Dispatched transfer ${number}: ${from.name} → ${to.name} (৳${round2(value).toFixed(2)} at cost)`,
        after: { number, fromBranchId: from.id, toBranchId: to.id, lines: merged.map((l) => ({ variationId: l.variationId, quantity: l.qty.toString() })) },
      },
      tx,
    )
    return { id: t.id, number }
  }, TX_OPTS)
}

async function lockTransfer(tx: Prisma.TransactionClient, companyId: string, id: string) {
  const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM stock_transfers WHERE id = ${id} AND companyId = ${companyId} FOR UPDATE`
  if (!row) throw notFound("Transfer")
  return tx.stockTransfer.findUniqueOrThrow({ where: { id }, include: { lines: true } })
}

/** Receive at destination: new batches at the dispatched cost (transfer_in), status completed. */
export async function receiveTransfer(ctx: TenantContext, id: string) {
  assertFeature(ctx, "multiBranchTransfer")
  return prisma.$transaction(async (tx) => {
    const t = await lockTransfer(tx, ctx.companyId, id)
    if (t.status !== "pending") throw businessRule(`This transfer is already ${t.status}`)
    if (!ctx.branchIds.includes(t.toBranchId)) throw forbidden("Only staff of the destination branch can receive this transfer")
    const branches = await branchMap(tx, ctx.companyId)
    const from = branches.get(t.fromBranchId)
    for (const l of t.lines) {
      await receiveStock(tx, {
        companyId: ctx.companyId,
        branchId: t.toBranchId,
        variationId: l.variationId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        source: "transfer",
        type: "transfer_in",
        batchNo: t.number,
        refType: "transfer",
        refId: t.id,
        userId: ctx.userId,
        note: `Transfer ${t.number} from ${from?.name ?? "branch"}`,
      })
    }
    const now = new Date()
    await tx.stockTransfer.update({ where: { id: t.id }, data: { status: "completed", receivedById: ctx.userId, receivedAt: now } })
    await audit(
      ctx,
      { action: "update", entityType: "stock_transfer", entityId: t.id, summary: `Received transfer ${t.number}`, before: { status: "pending" }, after: { status: "completed" } },
      tx,
    )
    return { id: t.id, status: "completed" as const }
  }, TX_OPTS)
}

/** Cancel a pending transfer: stock goes back to the source branch at the dispatched cost. */
export async function cancelTransfer(ctx: TenantContext, id: string, reason: string | null) {
  assertFeature(ctx, "multiBranchTransfer")
  return prisma.$transaction(async (tx) => {
    const t = await lockTransfer(tx, ctx.companyId, id)
    if (t.status !== "pending") throw businessRule(`This transfer is already ${t.status}`)
    if (!ctx.branchIds.includes(t.fromBranchId)) throw forbidden("Only staff of the source branch can cancel this transfer")
    for (const l of t.lines) {
      await receiveStock(tx, {
        companyId: ctx.companyId,
        branchId: t.fromBranchId,
        variationId: l.variationId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        source: "transfer",
        type: "transfer_in",
        batchNo: t.number,
        refType: "transfer",
        refId: t.id,
        userId: ctx.userId,
        note: "transfer cancelled",
      })
    }
    const note = reason ? `${t.note ? `${t.note} · ` : ""}Cancelled: ${reason}`.slice(0, 255) : t.note
    await tx.stockTransfer.update({ where: { id: t.id }, data: { status: "cancelled", note } })
    await audit(
      ctx,
      { action: "update", entityType: "stock_transfer", entityId: t.id, summary: `Cancelled transfer ${t.number}`, before: { status: "pending" }, after: { status: "cancelled", reason } },
      tx,
    )
    return { id: t.id, status: "cancelled" as const }
  }, TX_OPTS)
}

export async function getTransfer(ctx: TenantContext, id: string) {
  const t = await prisma.stockTransfer.findFirst({ where: { id, companyId: ctx.companyId }, include: { lines: true } })
  if (!t) return null
  if (!ctx.branchIds.includes(t.fromBranchId) && !ctx.branchIds.includes(t.toBranchId)) throw forbidden("You do not have access to this transfer")
  const showCost = can(ctx, "inventory.view_cost")
  const userIds = [t.createdById, t.receivedById].filter((x): x is string => !!x)
  const [vars, branches, users] = await Promise.all([
    variationInfo(prisma, ctx.companyId, t.lines.map((l) => l.variationId)),
    branchMap(prisma, ctx.companyId),
    prisma.user.findMany({ where: { companyId: ctx.companyId, id: { in: userIds } }, select: { id: true, name: true } }),
  ])
  const userName = (uid: string | null) => users.find((u) => u.id === uid)?.name ?? null
  return {
    id: t.id,
    number: t.number,
    status: t.status as TransferStatus,
    date: isoDate(t.date)!,
    note: t.note,
    fromBranchId: t.fromBranchId,
    toBranchId: t.toBranchId,
    fromName: branches.get(t.fromBranchId)?.name ?? "—",
    toName: branches.get(t.toBranchId)?.name ?? "—",
    createdBy: userName(t.createdById),
    createdAt: t.createdAt.toISOString(),
    receivedBy: userName(t.receivedById),
    receivedAt: t.receivedAt?.toISOString() ?? null,
    ...transferActions({ status: t.status as TransferStatus, fromBranchId: t.fromBranchId, toBranchId: t.toBranchId }, ctx.branchIds),
    showCost,
    value: showCost ? num(round2(sum(t.lines.map((l) => l.quantity.times(l.unitCost))))) : null,
    lines: t.lines.map((l) => {
      const v = vars.get(l.variationId)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: v?.productName ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.unit ?? "pcs",
        quantity: num(l.quantity),
        unitCost: showCost ? num(l.unitCost) : null,
        value: showCost ? num(round2(l.quantity.times(l.unitCost))) : null,
      }
    }),
  }
}
export type TransferDetail = NonNullable<Awaited<ReturnType<typeof getTransfer>>>
