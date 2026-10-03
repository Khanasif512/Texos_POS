import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { dec, round2 } from "@/server/decimal"

type Tx = Prisma.TransactionClient
type LedgerType = Prisma.CustomerLedgerEntryCreateInput["type"]
type Amt = Prisma.Decimal | number | string

/**
 * Customer ledger (CRM-02, SLS-04). debit = customer owes more (invoice, opening due, refund paid out),
 * credit = customer owes less (payment, return, credit note, advance).
 * Locks the customer row, updates the cached balance, appends the entry. Returns the new balance.
 */
export async function postCustomerLedger(
  tx: Tx,
  e: {
    companyId: string
    customerId: string
    branchId?: string | null
    type: LedgerType
    debit?: Amt
    credit?: Amt
    refType?: string
    refId?: string
    note?: string | null
    date?: Date
    userId?: string | null
  },
) {
  const [row] = await tx.$queryRaw<{ balance: string }[]>`
    SELECT balance FROM customers WHERE id = ${e.customerId} AND companyId = ${e.companyId} FOR UPDATE`
  if (!row) throw new Error("Customer not found for ledger posting")
  const debit = round2(e.debit ?? 0)
  const credit = round2(e.credit ?? 0)
  const balance = dec(row.balance).plus(debit).minus(credit)
  await tx.customer.update({ where: { id: e.customerId }, data: { balance } })
  await tx.customerLedgerEntry.create({
    data: {
      companyId: e.companyId,
      customerId: e.customerId,
      branchId: e.branchId ?? null,
      type: e.type,
      debit,
      credit,
      balanceAfter: balance,
      refType: e.refType ?? null,
      refId: e.refId ?? null,
      note: e.note ?? null,
      date: e.date ?? new Date(),
      createdById: e.userId ?? null,
    },
  })
  return balance
}

/**
 * Supplier ledger (SUP-02, FIN-03). credit = payable increases (purchase / LC value / opening),
 * debit = payable decreases (payment, adjustment). Returns the new payable balance.
 */
export async function postSupplierLedger(
  tx: Tx,
  e: {
    companyId: string
    supplierId: string
    type: LedgerType
    debit?: Amt
    credit?: Amt
    refType?: string
    refId?: string
    note?: string | null
    date?: Date
    userId?: string | null
  },
) {
  const [row] = await tx.$queryRaw<{ balance: string }[]>`
    SELECT balance FROM suppliers WHERE id = ${e.supplierId} AND companyId = ${e.companyId} FOR UPDATE`
  if (!row) throw new Error("Supplier not found for ledger posting")
  const debit = round2(e.debit ?? 0)
  const credit = round2(e.credit ?? 0)
  const balance = dec(row.balance).plus(credit).minus(debit)
  await tx.supplier.update({ where: { id: e.supplierId }, data: { balance } })
  await tx.supplierLedgerEntry.create({
    data: {
      companyId: e.companyId,
      supplierId: e.supplierId,
      type: e.type,
      debit,
      credit,
      balanceAfter: balance,
      refType: e.refType ?? null,
      refId: e.refId ?? null,
      note: e.note ?? null,
      date: e.date ?? new Date(),
      createdById: e.userId ?? null,
    },
  })
  return balance
}
