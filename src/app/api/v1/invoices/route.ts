import type { Prisma } from "@/generated/prisma/client"
import { listParams, ok, parseBody } from "@/server/api"
import { branchFilter } from "@/server/auth/context"
import { idempotent } from "@/server/idempotency"
import { dateRange } from "@/server/list"
import { num } from "@/server/decimal"
import { tenantRoute } from "@/server/route"
import { createInvoice, invoiceScope } from "@/server/modules/sales/service"
import { invoiceSchema } from "@/lib/validation/sales"

const SORTABLE = ["invoiceDate", "number", "total", "dueAmount", "createdAt"]
const STATUSES = ["confirmed", "partially_returned", "returned", "cancelled"] as const
type Status = (typeof STATUSES)[number]

/**
 * GET /api/v1/invoices?q&type&status&branchId&salesmanId&customerId&due=1&from&to&page&limit&sort
 * `due=1` returns only confirmed invoices with an outstanding amount (for receipts / returns pickers).
 */
export const GET = tenantRoute({ perm: "sales.view" }, async ({ req, ctx, db }) => {
  const p = listParams(req, SORTABLE, "invoiceDate:desc")
  const sp = p.sp
  const type = sp.get("type")
  const status = sp.get("status")
  const where: Prisma.InvoiceWhereInput = {
    AND: [
      branchFilter(ctx, p.branchId),
      invoiceScope(ctx),
      type === "cash" || type === "credit" ? { type } : {},
      status && STATUSES.includes(status as Status) ? { status: status as Status } : {},
      sp.get("salesmanId") ? { salesmanId: sp.get("salesmanId")! } : {},
      sp.get("customerId") ? { customerId: sp.get("customerId")! } : {},
      sp.get("due") === "1" ? { dueAmount: { gt: 0 }, status: { in: ["confirmed", "partially_returned"] } } : {},
      p.from || p.to ? { invoiceDate: dateRange(p.from, p.to) } : {},
      p.q ? { OR: [{ number: { contains: p.q } }, { customerName: { contains: p.q } }, { customerPhone: { contains: p.q } }] } : {},
    ],
  }
  const [rows, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: p.orderBy, skip: p.skip, take: p.limit }),
    db.invoice.count({ where }),
  ])
  return ok(
    rows.map((r) => ({
      id: r.id,
      number: r.number,
      type: r.type,
      status: r.status,
      branchId: r.branchId,
      customerId: r.customerId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      salesmanId: r.salesmanId,
      invoiceDate: r.invoiceDate,
      total: num(r.total),
      paidAmount: num(r.paidAmount),
      dueAmount: num(r.dueAmount),
      returnedAmount: num(r.returnedAmount),
      printCount: r.printCount,
    })),
    { meta: { page: p.page, limit: p.limit, total } },
  )
})

/** POST /api/v1/invoices — confirm a cash/credit sale (SLS-01..03). Send an Idempotency-Key header. */
export const POST = tenantRoute({ perm: "sales.create" }, async ({ req, ctx }) => {
  const input = await parseBody(req, invoiceSchema)
  return idempotent(req, ctx.companyId, "invoices.create", async () => {
    const data = await createInvoice(ctx, input)
    return { data, status: 201, message: `Invoice ${data.number} saved` }
  })
})
