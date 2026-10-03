import { listParams, ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"
import { num } from "@/server/decimal"
import { dateRange } from "@/server/list"
import { createManualInvoice } from "@/server/modules/platform/billing"
import { manualInvoiceSchema } from "@/lib/validation/billing"
import type { Prisma } from "@/generated/prisma/client"

const STATUSES = ["unpaid", "paid", "failed", "void"] as const

/** All billing invoices across tenants: ?status&companyId&from&to&q&page&limit&sort */
export const GET = adminRoute(async ({ req }) => {
  const p = listParams(req, ["issuedAt", "amount", "dueAt", "paidAt", "number"], "issuedAt:desc")
  const status = p.sp.get("status")
  const companyId = p.sp.get("companyId")
  const where: Prisma.BillingInvoiceWhereInput = {
    ...(status && (STATUSES as readonly string[]).includes(status) ? { status: status as (typeof STATUSES)[number] } : {}),
    ...(companyId ? { companyId } : {}),
    ...(dateRange(p.from, p.to) ? { issuedAt: dateRange(p.from, p.to) } : {}),
    ...(p.q ? { OR: [{ number: { contains: p.q } }, { description: { contains: p.q } }, { paymentReference: { contains: p.q } }, { company: { name: { contains: p.q } } }] } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.billingInvoice.findMany({ where, orderBy: p.orderBy, skip: p.skip, take: p.limit, include: { company: { select: { id: true, name: true } } } }),
    prisma.billingInvoice.count({ where }),
  ])
  return ok(
    rows.map((r) => ({ ...r, amount: num(r.amount) })),
    { meta: { page: p.page, limit: p.limit, total } },
  )
})

export const POST = adminRoute(async ({ req, admin }) => {
  const r = await createManualInvoice(admin, await parseBody(req, manualInvoiceSchema))
  return ok(r, { status: 201, message: `Invoice ${r.number} created` })
})
