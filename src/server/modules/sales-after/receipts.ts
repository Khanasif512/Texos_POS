import "server-only"
import { audit } from "@/server/audit"
import type { TenantContext } from "@/server/auth/context"
import { assertBranch } from "@/server/auth/context"
import type { TenantDb } from "@/server/db"
import { dec, num, round2, sum } from "@/server/decimal"
import { AppError, businessRule, notFound } from "@/server/errors"
import { postCustomerLedger } from "@/server/modules/ledger/service"
import { nextNumber } from "@/server/modules/common/sequence"
import type { AdvanceOutput, ApplyAdvanceOutput, CancelOutput, ReceiptOutput } from "@/lib/validation/sales-after"
import { allocateOldestFirst, applyAdvances } from "./calc"
import { ADVANCE_NOTE_PREFIX, OPEN_INVOICE_STATUSES, branchFor, docDateTime, isOpenForPayment, lockCustomer, lockInvoices, pd, run, type Tx } from "./shared"

// ───────── Queries ─────────

/** Unallocated part of each advance receipt of a customer (amount − Σ allocations). */
async function advanceBalances(db: Tx | TenantDb, companyId: string, customerId: string, branchIds: string[]) {
  const receipts = await db.moneyReceipt.findMany({
    where: { companyId, customerId, isAdvance: true, cancelledAt: null, branchId: { in: branchIds } },
    include: { allocations: { select: { amount: true } } },
    orderBy: [{ date: "asc" }, { number: "asc" }],
  })
  return receipts
    .map((r) => ({ id: r.id, number: r.number, date: r.date, amount: r.amount, remaining: dec(r.amount).minus(sum(r.allocations.map((a) => a.amount))) }))
    .filter((r) => r.remaining.gt(0))
}

async function openInvoicesFor(db: Tx | TenantDb, companyId: string, customerId: string, branchIds: string[], invoiceId?: string | null) {
  return db.invoice.findMany({
    where: {
      companyId,
      customerId,
      branchId: { in: branchIds },
      status: { in: [...OPEN_INVOICE_STATUSES] },
      dueAmount: { gt: 0 },
      ...(invoiceId ? { id: invoiceId } : {}),
    },
    orderBy: [{ invoiceDate: "asc" }, { number: "asc" }],
  })
}

/** Everything the receipt form needs for a customer: open credit invoices + unapplied advances. */
export async function customerDueSummary(ctx: TenantContext, db: TenantDb, customerId: string) {
  const customer = await db.customer.findFirst({ where: { id: customerId } })
  if (!customer) throw notFound("Customer")
  const [invoices, advances, branches] = await Promise.all([
    openInvoicesFor(db, ctx.companyId, customerId, ctx.branchIds),
    advanceBalances(db, ctx.companyId, customerId, ctx.branchIds),
    db.branch.findMany({ select: { id: true, name: true } }),
  ])
  const branchName = new Map(branches.map((b) => [b.id, b.name]))
  return {
    customer: {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      type: customer.type,
      creditLimit: num(customer.creditLimit),
      balance: num(customer.balance),
    },
    openInvoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      date: i.invoiceDate.toISOString(),
      branchName: branchName.get(i.branchId) ?? "—",
      total: num(i.total),
      paidAmount: num(i.paidAmount),
      dueAmount: num(i.dueAmount),
    })),
    totalDue: num(sum(invoices.map((i) => i.dueAmount))),
    unappliedAdvance: num(sum(advances.map((a) => a.remaining))),
    advances: advances.map((a) => ({ id: a.id, number: a.number, date: a.date.toISOString(), amount: num(a.amount), remaining: num(a.remaining) })),
  }
}
export type CustomerDueSummary = Awaited<ReturnType<typeof customerDueSummary>>

// ───────── Create (SLS-04) ─────────

async function writeAllocations(tx: Tx, receiptId: string, rows: { invoiceId: string; amount: ReturnType<typeof dec> }[]) {
  if (!rows.length) return
  await tx.receiptAllocation.createMany({ data: rows.map((r) => ({ receiptId, invoiceId: r.invoiceId, amount: r.amount })) })
  for (const r of rows)
    await tx.invoice.update({ where: { id: r.invoiceId }, data: { paidAmount: { increment: r.amount }, dueAmount: { decrement: r.amount } } })
}

/**
 * Record a money receipt: allocations to the customer's open invoices (oldest first unless given),
 * the remainder becomes an advance; customer ledger credit (type payment). One transaction.
 */
export async function createReceipt(ctx: TenantContext, input: ReceiptOutput) {
  return run(async (tx) => {
    const branch = await branchFor(tx, ctx, input.branchId)
    const customer = await lockCustomer(tx, ctx.companyId, input.customerId)
    if (customer.status !== "active") throw businessRule("This customer is inactive")
    const amount = round2(input.amount)

    let rows: { invoiceId: string; amount: ReturnType<typeof dec> }[]
    if (input.allocations === undefined) {
      const open = await openInvoicesFor(tx, ctx.companyId, customer.id, ctx.branchIds)
      await lockInvoices(tx, ctx.companyId, open.map((i) => i.id))
      const fresh = await openInvoicesFor(tx, ctx.companyId, customer.id, ctx.branchIds)
      rows = allocateOldestFirst(amount, fresh.map((i) => ({ id: i.id, dueAmount: i.dueAmount, date: i.invoiceDate }))).allocations.map((a) => ({
        invoiceId: a.invoiceId,
        amount: pd(a.amount),
      }))
    } else {
      const wanted = input.allocations.filter((a) => a.amount > 0)
      const invoices = await lockInvoices(tx, ctx.companyId, wanted.map((a) => a.invoiceId))
      rows = wanted.map((a, i) => {
        const inv = invoices.find((x) => x.id === a.invoiceId)
        if (!inv || inv.customerId !== customer.id) throw new AppError("VALIDATION_ERROR", "Invoice does not belong to this customer", { fields: { [`allocations.${i}.amount`]: "Not this customer's invoice" } })
        assertBranch(ctx, inv.branchId)
        const amt = round2(a.amount)
        if (!isOpenForPayment(inv)) throw businessRule(`Invoice ${inv.number} has nothing due`)
        if (amt.gt(inv.dueAmount))
          throw new AppError("VALIDATION_ERROR", `Invoice ${inv.number} only has ${num(inv.dueAmount).toFixed(2)} due`, {
            fields: { [`allocations.${i}.amount`]: `Max ${num(inv.dueAmount).toFixed(2)}` },
          })
        return { invoiceId: inv.id, amount: amt }
      })
    }
    const allocated = sum(rows.map((r) => r.amount))
    if (allocated.gt(amount)) throw businessRule("Allocated more than the amount received")
    const advance = amount.minus(allocated)

    const date = docDateTime(input.date)
    const number = await nextNumber(tx, { companyId: ctx.companyId, key: "MR", branchId: branch.id, branchCode: branch.code, date })
    const receipt = await tx.moneyReceipt.create({
      data: {
        companyId: ctx.companyId,
        branchId: branch.id,
        customerId: customer.id,
        invoiceId: rows.length === 1 ? rows[0].invoiceId : null,
        number,
        amount,
        method: input.method,
        reference: input.reference,
        note: input.note,
        date,
        isAdvance: advance.gt(0),
        createdById: ctx.userId,
      },
    })
    await writeAllocations(tx, receipt.id, rows)
    await postCustomerLedger(tx, {
      companyId: ctx.companyId,
      customerId: customer.id,
      branchId: branch.id,
      type: "payment",
      credit: amount,
      refType: "receipt",
      refId: receipt.id,
      note: advance.gt(0) ? `Money receipt ${number} (advance ${advance.toFixed(2)})` : `Money receipt ${number}`,
      date,
      userId: ctx.userId,
    })
    await audit(
      ctx,
      {
        action: "create",
        entityType: "money_receipt",
        entityId: receipt.id,
        summary: `Money receipt ${number}: ${amount.toFixed(2)} from ${customer.name}${advance.gt(0) ? ` (advance ${advance.toFixed(2)})` : ""}`,
        after: { ...receipt, allocations: rows },
      },
      tx,
    )
    return { id: receipt.id, number, amount: num(amount), allocated: num(allocated), advance: num(advance) }
  })
}

/** Advance receipt (no invoice) — used for order advances. Caller supplies the transaction. */
export async function createAdvanceReceiptTx(
  tx: Tx,
  ctx: TenantContext,
  args: { customerId: string; branch: { id: string; code: string }; advance: AdvanceOutput; note: string },
) {
  const date = args.advance.date ? docDateTime(args.advance.date) : new Date()
  const amount = round2(args.advance.amount)
  const number = await nextNumber(tx, { companyId: ctx.companyId, key: "MR", branchId: args.branch.id, branchCode: args.branch.code, date })
  const receipt = await tx.moneyReceipt.create({
    data: {
      companyId: ctx.companyId,
      branchId: args.branch.id,
      customerId: args.customerId,
      number,
      amount,
      method: args.advance.method,
      reference: args.advance.reference,
      note: args.note.slice(0, 255),
      date,
      isAdvance: true,
      createdById: ctx.userId,
    },
  })
  await postCustomerLedger(tx, {
    companyId: ctx.companyId,
    customerId: args.customerId,
    branchId: args.branch.id,
    type: "payment",
    credit: amount,
    refType: "receipt",
    refId: receipt.id,
    note: `Advance receipt ${number}`,
    date,
    userId: ctx.userId,
  })
  await audit(ctx, { action: "create", entityType: "money_receipt", entityId: receipt.id, summary: `Advance receipt ${number}: ${amount.toFixed(2)}`, after: receipt }, tx)
  return receipt
}

// ───────── Apply advance ─────────

/**
 * Allocate a customer's unapplied advances to open invoices (both oldest first).
 * No ledger entry: the advance was already credited when it was received.
 */
export async function applyAdvance(ctx: TenantContext, input: ApplyAdvanceOutput) {
  return run(async (tx) => {
    const customer = await lockCustomer(tx, ctx.companyId, input.customerId)
    const advances = await advanceBalances(tx, ctx.companyId, customer.id, ctx.branchIds)
    if (!advances.length) throw businessRule("This customer has no unapplied advance")
    const open = await openInvoicesFor(tx, ctx.companyId, customer.id, ctx.branchIds, input.invoiceId)
    await lockInvoices(tx, ctx.companyId, open.map((i) => i.id))
    const fresh = await openInvoicesFor(tx, ctx.companyId, customer.id, ctx.branchIds, input.invoiceId)
    if (!fresh.length) throw businessRule("There are no open invoices to apply the advance to")
    const rows = applyAdvances(
      advances.map((a) => ({ id: a.id, remaining: a.remaining })),
      fresh.map((i) => ({ id: i.id, dueAmount: i.dueAmount, date: i.invoiceDate })),
    )
    for (const r of rows) {
      await tx.receiptAllocation.create({ data: { receiptId: r.receiptId, invoiceId: r.invoiceId, amount: pd(r.amount) } })
      await tx.invoice.update({ where: { id: r.invoiceId }, data: { paidAmount: { increment: pd(r.amount) }, dueAmount: { decrement: pd(r.amount) } } })
    }
    const applied = rows.reduce((a, r) => a.plus(r.amount), dec(0))
    const numbers = new Map(fresh.map((i) => [i.id, i.number]))
    await audit(
      ctx,
      {
        action: "update",
        entityType: "money_receipt",
        summary: `Applied advance ${applied.toFixed(2)} of ${customer.name} to ${[...new Set(rows.map((r) => numbers.get(r.invoiceId)))].join(", ")}`,
        after: rows.map((r) => ({ receiptId: r.receiptId, invoiceId: r.invoiceId, amount: r.amount.toFixed(2) })),
      },
      tx,
    )
    return { applied: num(applied), invoices: new Set(rows.map((r) => r.invoiceId)).size }
  })
}

// ───────── Cancel ─────────

/** Cancel a receipt: reverse its allocations and invoice paid/due, debit the ledger back (type adjustment). */
export async function cancelReceipt(ctx: TenantContext, id: string, input: CancelOutput) {
  return run(async (tx) => {
    const receipt = await tx.moneyReceipt.findFirst({ where: { id, companyId: ctx.companyId }, include: { allocations: true } })
    if (!receipt) throw notFound("Money receipt")
    assertBranch(ctx, receipt.branchId)
    if (receipt.cancelledAt) throw businessRule("This receipt is already cancelled")
    if (receipt.customerId) await lockCustomer(tx, ctx.companyId, receipt.customerId)
    const fresh = await tx.moneyReceipt.findUniqueOrThrow({ where: { id }, include: { allocations: true } })
    if (fresh.cancelledAt) throw businessRule("This receipt is already cancelled")

    const invoices = await lockInvoices(tx, ctx.companyId, fresh.allocations.map((a) => a.invoiceId))
    for (const a of fresh.allocations) {
      const inv = invoices.find((i) => i.id === a.invoiceId)
      if (!inv || inv.status === "cancelled") continue
      await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: { decrement: a.amount }, dueAmount: { increment: a.amount } } })
    }
    await tx.receiptAllocation.deleteMany({ where: { receiptId: id } })
    const note = `${fresh.note ? `${fresh.note} · ` : ""}Cancelled: ${input.reason}`.slice(0, 255)
    const now = new Date()
    await tx.moneyReceipt.update({ where: { id }, data: { cancelledAt: now, note } })

    // an order advance being cancelled lowers the order's advance
    if (fresh.isAdvance && fresh.note?.startsWith(ADVANCE_NOTE_PREFIX)) {
      const orderNo = fresh.note.slice(ADVANCE_NOTE_PREFIX.length).split(" ")[0]
      const order = await tx.salesOrder.findFirst({ where: { companyId: ctx.companyId, number: orderNo } })
      if (order) {
        const left = dec(order.advanceAmount).minus(fresh.amount)
        await tx.salesOrder.update({ where: { id: order.id }, data: { advanceAmount: left.gt(0) ? left : dec(0) } })
      }
    }

    if (fresh.customerId)
      await postCustomerLedger(tx, {
        companyId: ctx.companyId,
        customerId: fresh.customerId,
        branchId: fresh.branchId,
        type: "adjustment",
        debit: fresh.amount,
        refType: "receipt",
        refId: fresh.id,
        note: `Cancelled receipt ${fresh.number}: ${input.reason}`.slice(0, 255),
        date: now,
        userId: ctx.userId,
      })
    await audit(
      ctx,
      {
        action: "cancel",
        entityType: "money_receipt",
        entityId: id,
        summary: `Cancelled money receipt ${fresh.number} (${dec(fresh.amount).toFixed(2)}): ${input.reason}`,
        before: fresh,
        after: { cancelledAt: now, reason: input.reason },
      },
      tx,
    )
    return { id, number: fresh.number, reversed: num(sum(fresh.allocations.map((a) => a.amount))) }
  })
}

// ───────── Print status ─────────

export async function recordReceiptPrint(ctx: TenantContext, db: TenantDb, id: string) {
  const r = await db.moneyReceipt.findFirst({ where: { id }, select: { id: true, branchId: true } })
  if (!r) throw notFound("Money receipt")
  assertBranch(ctx, r.branchId)
  const [updated] = await Promise.all([
    db.moneyReceipt.update({ where: { id }, data: { printCount: { increment: 1 } }, select: { printCount: true } }),
    db.printLog.create({ data: { companyId: ctx.companyId, docType: "receipt", docId: id, userId: ctx.userId } }),
  ])
  return { printCount: updated.printCount }
}
