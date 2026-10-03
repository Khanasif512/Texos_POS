import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { prisma, type TenantDb } from "@/server/db"
import { AppError, businessRule, notFound } from "@/server/errors"
import { audit } from "@/server/audit"
import { assertBranch, assertFeature, type TenantContext } from "@/server/auth/context"
import { nextNumber } from "@/server/modules/common/sequence"
import { dec, round2 } from "@/server/decimal"
import type { DeliveryChargeOutput, ExpenseCategoryOutput, ExpenseOutput } from "@/lib/validation/finance"
import { dbDate, dbDateKey } from "./calc"
import { assertCashDayOpen } from "./guards"

type Tx = Prisma.TransactionClient

export const DELIVERY_CATEGORY = "Delivery Charge"

// ───────── Categories (EXP-01) ─────────

export async function createCategory(ctx: TenantContext, db: TenantDb, input: ExpenseCategoryOutput) {
  if (await db.expenseCategory.findFirst({ where: { name: input.name }, select: { id: true } }))
    throw new AppError("CONFLICT", "A category with this name already exists", { fields: { name: "Already exists" } })
  const cat = await db.expenseCategory.create({
    data: { companyId: ctx.companyId, name: input.name, lcCostType: input.lcCostType, status: input.status, isSystem: false },
  })
  await audit(ctx, { action: "create", entityType: "expense_category", entityId: cat.id, summary: `Created expense category ${cat.name}`, after: cat })
  return cat
}

export async function updateCategory(ctx: TenantContext, db: TenantDb, id: string, input: ExpenseCategoryOutput) {
  const before = await db.expenseCategory.findFirst({ where: { id } })
  if (!before) throw notFound("Expense category")
  if (before.isSystem && input.name !== before.name) throw businessRule("Default categories cannot be renamed.")
  if (before.isSystem && before.name === DELIVERY_CATEGORY && input.status === "inactive")
    throw businessRule("The Delivery Charge category is used by LC delivery charges and cannot be deactivated.")
  if (input.name !== before.name && (await db.expenseCategory.findFirst({ where: { name: input.name, id: { not: id } }, select: { id: true } })))
    throw new AppError("CONFLICT", "A category with this name already exists", { fields: { name: "Already exists" } })
  const cat = await db.expenseCategory.update({ where: { id }, data: { name: input.name, lcCostType: input.lcCostType, status: input.status } })
  await audit(ctx, { action: "update", entityType: "expense_category", entityId: id, summary: `Updated expense category ${cat.name}`, before, after: cat })
  return cat
}

export async function deleteCategory(ctx: TenantContext, db: TenantDb, id: string) {
  const cat = await db.expenseCategory.findFirst({ where: { id }, include: { _count: { select: { expenses: true } } } })
  if (!cat) throw notFound("Expense category")
  if (cat.isSystem) throw businessRule("Default categories cannot be deleted. You can deactivate them instead.")
  if (cat._count.expenses > 0) throw businessRule(`${cat._count.expenses} expense(s) use this category. Deactivate it instead of deleting.`)
  await db.expenseCategory.delete({ where: { id } })
  await audit(ctx, { action: "delete", entityType: "expense_category", entityId: id, summary: `Deleted expense category ${cat.name}`, before: cat })
}

// ───────── Expenses (EXP-02) + LC cost items (LC-09) ─────────

type ExpenseRow = Prisma.ExpenseGetPayload<object>
type Source = "expense" | "delivery_charge"

async function loadBranch(tx: Tx, ctx: TenantContext, branchId: string) {
  assertBranch(ctx, branchId)
  const branch = await tx.branch.findFirst({ where: { id: branchId, companyId: ctx.companyId }, select: { id: true, code: true, name: true, status: true } })
  if (!branch || branch.status !== "active") throw new AppError("VALIDATION_ERROR", "Choose an active branch", { fields: { branchId: "Invalid branch" } })
  return branch
}

async function loadCategory(tx: Tx, ctx: TenantContext, categoryId: string, allowInactiveId?: string) {
  const cat = await tx.expenseCategory.findFirst({ where: { id: categoryId, companyId: ctx.companyId } })
  if (!cat || (cat.status !== "active" && cat.id !== allowInactiveId))
    throw new AppError("VALIDATION_ERROR", "Choose an active category", { fields: { categoryId: "Invalid category" } })
  return cat
}

async function loadLc(tx: Tx, ctx: TenantContext, lcId: string) {
  assertFeature(ctx, "lc")
  const lc = await tx.lc.findFirst({ where: { id: lcId, companyId: ctx.companyId }, select: { id: true, lcNumber: true, status: true, supplierId: true } })
  if (!lc) throw new AppError("VALIDATION_ERROR", "Choose a valid LC", { fields: { lcId: "LC not found" } })
  return lc
}

function closedLc(lcNumber: string) {
  return businessRule(`LC ${lcNumber} is closed. Its costs can no longer change.`)
}

/**
 * Keeps the expense's linked LcCostItem in sync (create / update / delete) inside the same transaction.
 * Closed LCs cannot receive new items and their existing items cannot change.
 */
async function syncLcCostItem(
  tx: Tx,
  ctx: TenantContext,
  expense: ExpenseRow,
  opts: { costType: Prisma.LcCostItemCreateInput["costType"]; source: Source },
) {
  const existing = await tx.lcCostItem.findFirst({
    where: { companyId: ctx.companyId, sourceType: { in: ["expense", "delivery_charge"] }, sourceId: expense.id },
  })
  const wanted = expense.lcId && expense.allocateToLc

  if (existing && (!wanted || existing.lcId !== expense.lcId)) {
    const old = await tx.lc.findFirst({ where: { id: existing.lcId, companyId: ctx.companyId }, select: { lcNumber: true, status: true } })
    if (old?.status === "closed") throw closedLc(old.lcNumber)
    await tx.lcCostItem.delete({ where: { id: existing.id } })
  }
  if (!wanted) return null

  const lc = await loadLc(tx, ctx, expense.lcId!)
  const data = {
    costType: opts.costType,
    amount: expense.amount,
    description: (expense.description ?? `Expense ${expense.number}`).slice(0, 255),
    entryDate: expense.date,
  }
  if (existing && existing.lcId === expense.lcId) {
    const changed =
      !dec(existing.amount).equals(dec(data.amount)) || existing.costType !== data.costType || dbDateKey(existing.entryDate) !== dbDateKey(data.entryDate)
    if (changed && lc.status === "closed") throw closedLc(lc.lcNumber)
    return tx.lcCostItem.update({ where: { id: existing.id }, data })
  }
  if (lc.status === "closed") throw closedLc(lc.lcNumber)
  return tx.lcCostItem.create({
    data: {
      ...data,
      companyId: ctx.companyId,
      lcId: lc.id,
      sourceType: opts.source,
      sourceId: expense.id,
      createdById: ctx.userId,
    },
  })
}

const expenseSnapshot = (e: ExpenseRow) => ({
  number: e.number,
  branchId: e.branchId,
  categoryId: e.categoryId,
  amount: e.amount.toString(),
  method: e.method,
  date: dbDateKey(e.date),
  lcId: e.lcId,
  allocateToLc: e.allocateToLc,
  description: e.description,
  reference: e.reference,
})

async function writeExpense(
  ctx: TenantContext,
  input: ExpenseOutput,
  opts: { id?: string; source: Source; costType?: Prisma.LcCostItemCreateInput["costType"] },
) {
  return prisma.$transaction(async (tx) => {
    const before = opts.id ? await tx.expense.findFirst({ where: { id: opts.id, companyId: ctx.companyId } }) : null
    if (opts.id && !before) throw notFound("Expense")
    if (before) assertBranch(ctx, before.branchId)
    const branch = await loadBranch(tx, ctx, input.branchId)
    const category = await loadCategory(tx, ctx, input.categoryId, before?.categoryId)
    if (input.lcId) await loadLc(tx, ctx, input.lcId)

    // cash already counted for a closed day cannot silently change (FIN-01)
    if (before && before.method === "cash") await assertCashDayOpen(tx, ctx, before.branchId, dbDateKey(before.date))
    if (input.method === "cash") await assertCashDayOpen(tx, ctx, branch.id, input.date)

    const data = {
      branchId: branch.id,
      categoryId: category.id,
      amount: round2(input.amount),
      method: input.method,
      date: dbDate(input.date),
      description: input.description,
      reference: input.reference,
      lcId: input.lcId,
      allocateToLc: !!input.lcId && input.allocateToLc,
    }
    let expense: ExpenseRow
    if (before) {
      expense = await tx.expense.update({ where: { id: before.id }, data })
    } else {
      const number = await nextNumber(tx, { companyId: ctx.companyId, key: "EXP", branchId: branch.id, branchCode: branch.code, date: dbDate(input.date) })
      expense = await tx.expense.create({ data: { ...data, companyId: ctx.companyId, number, createdById: ctx.userId } })
    }
    const item = await syncLcCostItem(tx, ctx, expense, {
      costType: opts.costType ?? category.lcCostType ?? "other",
      source: opts.source,
    })
    const kind = opts.source === "delivery_charge" ? "delivery charge" : "expense"
    await audit(
      ctx,
      {
        action: before ? "update" : "create",
        entityType: opts.source === "delivery_charge" ? "delivery_charge" : "expense",
        entityId: expense.id,
        summary: `${before ? "Updated" : "Recorded"} ${kind} ${expense.number} · ${category.name} ৳${expense.amount.toFixed(2)}${item ? " (allocated to LC)" : ""}`,
        before: before ? expenseSnapshot(before) : undefined,
        after: expenseSnapshot(expense),
      },
      tx,
    )
    return { id: expense.id, number: expense.number, lcCostItemId: item?.id ?? null }
  })
}

export const createExpense = (ctx: TenantContext, input: ExpenseOutput) => writeExpense(ctx, input, { source: "expense" })

export async function updateExpense(ctx: TenantContext, id: string, input: ExpenseOutput) {
  const item = await prisma.lcCostItem.findFirst({ where: { companyId: ctx.companyId, sourceId: id, sourceType: "delivery_charge" }, select: { id: true } })
  return writeExpense(ctx, input, item ? { id, source: "delivery_charge", costType: "delivery" } : { id, source: "expense" })
}

export async function deleteExpense(ctx: TenantContext, id: string) {
  await prisma.$transaction(async (tx) => {
    const e = await tx.expense.findFirst({ where: { id, companyId: ctx.companyId }, include: { category: { select: { name: true } } } })
    if (!e) throw notFound("Expense")
    assertBranch(ctx, e.branchId)
    if (e.method === "cash") await assertCashDayOpen(tx, ctx, e.branchId, dbDateKey(e.date))
    const items = await tx.lcCostItem.findMany({ where: { companyId: ctx.companyId, sourceId: e.id, sourceType: { in: ["expense", "delivery_charge"] } } })
    for (const it of items) {
      const lc = await tx.lc.findFirst({ where: { id: it.lcId, companyId: ctx.companyId }, select: { lcNumber: true, status: true } })
      if (lc?.status === "closed") throw closedLc(lc.lcNumber)
    }
    await tx.lcCostItem.deleteMany({ where: { id: { in: items.map((i) => i.id) } } })
    await tx.expense.delete({ where: { id: e.id } })
    await audit(
      ctx,
      {
        action: "delete",
        entityType: items.some((i) => i.sourceType === "delivery_charge") ? "delivery_charge" : "expense",
        entityId: e.id,
        summary: `Deleted expense ${e.number} · ${e.category.name} ৳${e.amount.toFixed(2)}`,
        before: expenseSnapshot(e),
      },
      tx,
    )
  })
}

// ───────── Delivery charges (DLV-01, LC-09) ─────────

export async function deliveryCategory(companyId: string) {
  const cat =
    (await prisma.expenseCategory.findFirst({ where: { companyId, name: DELIVERY_CATEGORY } })) ??
    (await prisma.expenseCategory.findFirst({ where: { companyId, lcCostType: "delivery", status: "active" }, orderBy: { isSystem: "desc" } }))
  if (cat) return cat
  // workspaces provisioned before EXP-01 defaults: create the system category on first use
  return prisma.expenseCategory.create({ data: { companyId, name: DELIVERY_CATEGORY, isSystem: true, lcCostType: "delivery" } })
}

const deliveryToExpense = (categoryId: string, input: DeliveryChargeOutput): ExpenseOutput => ({
  branchId: input.branchId,
  categoryId,
  amount: input.amount,
  method: input.method,
  date: input.date,
  description: input.description,
  reference: input.reference,
  lcId: input.lcId,
  allocateToLc: true,
})

export async function createDeliveryCharge(ctx: TenantContext, input: DeliveryChargeOutput) {
  const cat = await deliveryCategory(ctx.companyId)
  return writeExpense(ctx, deliveryToExpense(cat.id, input), { source: "delivery_charge", costType: "delivery" })
}

export async function updateDeliveryCharge(ctx: TenantContext, id: string, input: DeliveryChargeOutput) {
  const existing = await prisma.expense.findFirst({ where: { id, companyId: ctx.companyId }, select: { categoryId: true } })
  if (!existing) throw notFound("Delivery charge")
  return writeExpense(ctx, deliveryToExpense(existing.categoryId, input), { id, source: "delivery_charge", costType: "delivery" })
}

/** Delivery charge rows = expenses carrying a delivery_charge LC cost item, or in the delivery category with an LC. */
export async function deliveryChargeWhere(companyId: string): Promise<Prisma.ExpenseWhereInput> {
  const cat = await deliveryCategory(companyId)
  return { lcId: { not: null }, categoryId: cat.id }
}
