import "server-only"
import { prisma } from "@/server/db"
import { notFound } from "@/server/errors"
import { assertBranch, can, type TenantContext } from "@/server/auth/context"
import { dec, num } from "@/server/decimal"
import { cancelWindow, cancelWindowHours, lineProfit } from "./calc"
import { invoiceScope } from "./service"

/** Serializable invoice read model shared by the detail page, print page and GET /api/v1/invoices/[id]. */
export async function getInvoiceDetail(ctx: TenantContext, id: string) {
  const inv = await prisma.invoice.findFirst({
    where: { id, companyId: ctx.companyId, ...invoiceScope(ctx) },
    include: { lines: { orderBy: { id: "asc" } }, challans: { orderBy: { createdAt: "asc" } } },
  })
  if (!inv) throw notFound("Invoice")
  assertBranch(ctx, inv.branchId)

  const userIds = [inv.salesmanId, inv.createdById, inv.cancelledById, inv.creditOverrideById].filter((x): x is string => !!x)
  const allocs = await prisma.receiptAllocation.findMany({ where: { invoiceId: id }, select: { receiptId: true, amount: true } })
  const [branch, customer, variations, receipts, printLogs, company, returns] = await Promise.all([
    prisma.branch.findFirst({ where: { id: inv.branchId, companyId: ctx.companyId }, select: { id: true, name: true, code: true, address: true, phone: true } }),
    inv.customerId ? prisma.customer.findFirst({ where: { id: inv.customerId, companyId: ctx.companyId } }) : null,
    prisma.productVariation.findMany({
      where: { companyId: ctx.companyId, id: { in: inv.lines.map((l) => l.variationId) } },
      include: { product: { select: { name: true, unit: true } } },
    }),
    prisma.moneyReceipt.findMany({
      where: { companyId: ctx.companyId, OR: [{ invoiceId: id }, { id: { in: allocs.map((a) => a.receiptId) } }] },
      orderBy: { date: "asc" },
    }),
    prisma.printLog.findMany({
      where: {
        companyId: ctx.companyId,
        OR: [
          { docType: "invoice", docId: id },
          { docType: "challan", docId: { in: inv.challans.map((c) => c.id) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.company.findUnique({ where: { id: ctx.companyId }, select: { settings: true } }),
    prisma.salesReturn.count({ where: { companyId: ctx.companyId, invoiceId: id, status: { not: "rejected" } } }),
  ])
  const allUserIds = [...new Set([...userIds, ...printLogs.map((p) => p.userId).filter((x): x is string => !!x), ...receipts.map((r) => r.createdById).filter((x): x is string => !!x)])]
  const users = await prisma.user.findMany({ where: { companyId: ctx.companyId, id: { in: allUserIds } }, select: { id: true, name: true } })
  const userName = (uid: string | null) => (uid ? (users.find((u) => u.id === uid)?.name ?? "—") : null)
  const varMap = new Map(variations.map((v) => [v.id, v]))
  const allocAmount = new Map(allocs.map((a) => [a.receiptId, num(a.amount)]))
  const showCost = can(ctx, "inventory.view_cost")
  const cw = cancelWindow({ createdAt: inv.createdAt, windowHours: cancelWindowHours(company?.settings), isOwner: ctx.isOwner })
  const challanNumbers = new Map(inv.challans.map((c) => [c.id, c.number]))

  const blockers: string[] = []
  if (inv.status !== "confirmed") blockers.push(inv.status === "cancelled" ? "Already cancelled" : "Invoice has returns")
  if (returns) blockers.push("Invoice has a sales return")
  if (inv.challans.some((c) => c.status === "delivered")) blockers.push("Goods already delivered")
  if (!cw.open) blockers.push(`Cancel window of ${cw.hours} hours has passed`)

  return {
    id: inv.id,
    number: inv.number,
    type: inv.type,
    status: inv.status,
    invoiceDate: inv.invoiceDate.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    branch: branch ?? { id: inv.branchId, name: "—", code: "", address: null, phone: null },
    customer: customer
      ? {
          id: customer.id,
          code: customer.code,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          type: customer.type,
          balance: num(customer.balance),
          creditLimit: num(customer.creditLimit),
        }
      : null,
    customerName: inv.customerName,
    customerPhone: inv.customerPhone,
    salesman: inv.salesmanId ? { id: inv.salesmanId, name: userName(inv.salesmanId) } : null,
    createdBy: userName(inv.createdById),
    salesOrderId: inv.salesOrderId,
    subtotal: num(inv.subtotal),
    discount: num(inv.discount),
    tax: num(inv.tax),
    deliveryCharge: num(inv.deliveryCharge),
    total: num(inv.total),
    paidAmount: num(inv.paidAmount),
    dueAmount: num(inv.dueAmount),
    returnedAmount: num(inv.returnedAmount),
    costTotal: showCost ? num(inv.costTotal) : null,
    profit: showCost ? num(dec(inv.subtotal).minus(dec(inv.discount)).minus(dec(inv.costTotal))) : null,
    paymentMethod: inv.paymentMethod,
    note: inv.note,
    printCount: inv.printCount,
    lastPrintedAt: inv.lastPrintedAt?.toISOString() ?? null,
    creditOverrideBy: userName(inv.creditOverrideById),
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    cancelledBy: userName(inv.cancelledById),
    cancelReason: inv.cancelReason,
    canCancel: blockers.length === 0,
    cancelBlockers: blockers,
    cancelDeadline: cw.deadline.toISOString(),
    lines: inv.lines.map((l) => {
      const v = varMap.get(l.variationId)
      return {
        id: l.id,
        variationId: l.variationId,
        productName: v?.product.name ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.product.unit ?? "pcs",
        description: l.description,
        quantity: num(l.quantity),
        returnedQty: num(l.returnedQty),
        unitPrice: num(l.unitPrice),
        discount: num(l.discount),
        lineTotal: num(l.lineTotal),
        unitCost: showCost ? num(l.unitCost) : null,
        profit: showCost ? num(lineProfit(l)) : null,
      }
    }),
    receipts: receipts.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date.toISOString(),
      amount: num(r.amount),
      allocated: allocAmount.get(r.id) ?? num(r.amount),
      method: r.method,
      reference: r.reference,
      cancelled: !!r.cancelledAt,
      createdBy: userName(r.createdById),
    })),
    challans: inv.challans.map((c) => ({
      id: c.id,
      number: c.number,
      status: c.status,
      deliveryAddress: c.deliveryAddress,
      deliveryPerson: c.deliveryPerson,
      deliveryPhone: c.deliveryPhone,
      vehicleNo: c.vehicleNo,
      deliveryDate: c.deliveryDate?.toISOString() ?? null,
      deliveredAt: c.deliveredAt?.toISOString() ?? null,
      showPrices: c.showPrices,
      printCount: c.printCount,
      note: c.note,
    })),
    printLogs: printLogs.map((p) => ({
      id: p.id,
      docType: p.docType,
      docNumber: p.docType === "invoice" ? inv.number : (challanNumbers.get(p.docId) ?? ""),
      user: userName(p.userId),
      at: p.createdAt.toISOString(),
    })),
  }
}
export type InvoiceDetail = Awaited<ReturnType<typeof getInvoiceDetail>>

/** Company letterhead for printed documents. */
export async function getLetterhead(companyId: string) {
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, address: true, phone: true, email: true, binNumber: true, tradeLicense: true, invoiceFooter: true, logoUrl: true },
  })
  if (!c) throw notFound("Company")
  return c
}
export type Letterhead = Awaited<ReturnType<typeof getLetterhead>>

/** Challan with its invoice lines for the challan print page. */
export async function getChallanDetail(ctx: TenantContext, id: string) {
  const ch = await prisma.challan.findFirst({ where: { id, companyId: ctx.companyId }, include: { invoice: { include: { lines: { orderBy: { id: "asc" } } } } } })
  if (!ch) throw notFound("Challan")
  assertBranch(ctx, ch.branchId)
  const inv = ch.invoice
  const [branch, customer, variations] = await Promise.all([
    prisma.branch.findFirst({ where: { id: ch.branchId, companyId: ctx.companyId }, select: { name: true, code: true, address: true, phone: true } }),
    inv.customerId ? prisma.customer.findFirst({ where: { id: inv.customerId, companyId: ctx.companyId }, select: { name: true, phone: true, code: true, address: true } }) : null,
    prisma.productVariation.findMany({
      where: { companyId: ctx.companyId, id: { in: inv.lines.map((l) => l.variationId) } },
      include: { product: { select: { name: true, unit: true } } },
    }),
  ])
  const varMap = new Map(variations.map((v) => [v.id, v]))
  return {
    id: ch.id,
    number: ch.number,
    status: ch.status,
    createdAt: ch.createdAt.toISOString(),
    deliveryAddress: ch.deliveryAddress,
    deliveryPerson: ch.deliveryPerson,
    deliveryPhone: ch.deliveryPhone,
    vehicleNo: ch.vehicleNo,
    deliveryDate: ch.deliveryDate?.toISOString() ?? null,
    deliveredAt: ch.deliveredAt?.toISOString() ?? null,
    showPrices: ch.showPrices,
    printCount: ch.printCount,
    note: ch.note,
    branch,
    invoice: {
      id: inv.id,
      number: inv.number,
      type: inv.type,
      status: inv.status,
      invoiceDate: inv.invoiceDate.toISOString(),
      total: num(inv.total),
      customerName: customer?.name ?? inv.customerName,
      customerPhone: customer?.phone ?? inv.customerPhone,
      customerCode: customer?.code ?? null,
    },
    lines: inv.lines.map((l) => {
      const v = varMap.get(l.variationId)
      return {
        id: l.id,
        productName: v?.product.name ?? "Unknown product",
        variationName: v?.name ?? "",
        sku: v?.sku ?? "",
        unit: v?.product.unit ?? "pcs",
        description: l.description,
        quantity: num(l.quantity),
        unitPrice: num(l.unitPrice),
        lineTotal: num(l.lineTotal),
      }
    }),
  }
}
export type ChallanDetail = Awaited<ReturnType<typeof getChallanDetail>>
