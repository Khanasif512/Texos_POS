import type { Metadata } from "next"
import { PosClient } from "@/components/pos/pos-client"
import type { CartLine, OrderPreload } from "@/components/pos/pos-types"
import { ensurePermission, requireTenant, type TenantContext } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { num } from "@/server/decimal"
import { listSalesmen } from "@/server/modules/sales/service"

export const metadata: Metadata = { title: "Point of sale" }

/** Loads an open quotation / sales order into the cart (?fromOrder=<id>). */
async function loadOrder(ctx: TenantContext, id: string): Promise<{ order: OrderPreload | null; error: string | null }> {
  const order = await prisma.salesOrder.findFirst({ where: { id, companyId: ctx.companyId }, include: { lines: true } })
  if (!order) return { order: null, error: "That quotation or order was not found." }
  if (order.status !== "open") return { order: null, error: `${order.number} is already ${order.status} and cannot be invoiced again.` }
  if (!ctx.branchIds.includes(order.branchId)) return { order: null, error: `${order.number} belongs to a branch you do not have access to.` }

  const ids = order.lines.map((l) => l.variationId)
  const [customer, variations, balances] = await Promise.all([
    order.customerId ? prisma.customer.findFirst({ where: { id: order.customerId, companyId: ctx.companyId } }) : null,
    prisma.productVariation.findMany({ where: { companyId: ctx.companyId, id: { in: ids } }, include: { product: { select: { name: true, unit: true } } } }),
    prisma.stockBalance.findMany({ where: { companyId: ctx.companyId, branchId: order.branchId, variationId: { in: ids } } }),
  ])
  const vMap = new Map(variations.map((v) => [v.id, v]))
  const stock = new Map(balances.map((b) => [b.variationId, num(b.quantity)]))
  const lines: CartLine[] = []
  for (const l of order.lines) {
    const v = vMap.get(l.variationId)
    if (!v) continue
    const existing = lines.find((x) => x.variationId === v.id)
    if (existing) {
      existing.qty = String(Number(existing.qty) + num(l.quantity))
      existing.discount = String(Number(existing.discount || 0) + num(l.discount))
      continue
    }
    lines.push({
      variationId: v.id,
      productName: v.product.name,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      unit: v.product.unit,
      stock: stock.get(v.id) ?? 0,
      listPrice: num(l.unitPrice),
      qty: String(num(l.quantity)),
      price: String(num(l.unitPrice)),
      discount: num(l.discount) ? String(num(l.discount)) : "",
    })
  }
  return {
    error: null,
    order: {
      id: order.id,
      number: order.number,
      type: order.type,
      branchId: order.branchId,
      discount: num(order.discount),
      note: order.note,
      salesmanId: order.salesmanId,
      customer:
        customer && customer.status === "active"
          ? {
              id: customer.id,
              code: customer.code,
              name: customer.name,
              phone: customer.phone,
              address: customer.address,
              type: customer.type,
              creditLimit: num(customer.creditLimit),
              balance: num(customer.balance),
            }
          : null,
      lines,
    },
  }
}

export default async function PosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireTenant("/app/pos")
  ensurePermission(ctx, "sales.create")
  const sp = await searchParams
  const fromOrder = typeof sp.fromOrder === "string" ? sp.fromOrder : null
  const [salesmen, loaded] = await Promise.all([listSalesmen(ctx), fromOrder ? loadOrder(ctx, fromOrder) : Promise.resolve({ order: null, error: null })])
  return <PosClient key={loaded.order?.id ?? "pos"} salesmen={salesmen} order={loaded.order} orderError={loaded.error} />
}
