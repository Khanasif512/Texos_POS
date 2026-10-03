import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import type { TenantContext } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { businessRule, notFound } from "@/server/errors"
import { readListParams } from "@/server/list"

type Tx = Prisma.TransactionClient
type Reader = Pick<typeof prisma, "productVariation" | "branch"> | Tx

export type VariationInfo = { id: string; productName: string; name: string; sku: string; unit: string; label: string }

/** Product/variation display info for line items (lines carry only variationId). */
export async function variationInfo(db: Reader, companyId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  const rows = unique.length
    ? await db.productVariation.findMany({
        where: { companyId, id: { in: unique } },
        select: { id: true, name: true, sku: true, status: true, product: { select: { name: true, unit: true, status: true } } },
      })
    : []
  return new Map(
    rows.map((v) => [
      v.id,
      {
        id: v.id,
        productName: v.product.name,
        name: v.name,
        sku: v.sku,
        unit: v.product.unit,
        label: `${v.product.name} — ${v.name}`,
        active: v.status === "active" && v.product.status === "active",
      },
    ]),
  )
}

/** VariationPicker option objects for existing lines (edit forms). Stock = sum over the user's branches or one branch. */
export async function variationOptions(ctx: TenantContext, ids: string[], branchId?: string) {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map<string, never>()
  const rows = await prisma.productVariation.findMany({
    where: { companyId: ctx.companyId, id: { in: unique } },
    include: {
      product: { select: { name: true, unit: true } },
      balances: { where: { branchId: branchId ? branchId : { in: ctx.branchIds } } },
    },
  })
  return new Map(
    rows.map((v) => [
      v.id,
      {
        id: v.id,
        productId: v.productId,
        productName: v.product.name,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        unit: v.product.unit,
        unitWeight: Number(v.unitWeight.toString()),
        salePrice: Number(v.salePrice.toString()),
        wholesalePrice: v.wholesalePrice == null ? null : Number(v.wholesalePrice.toString()),
        stock: v.balances.reduce((a, b) => a + Number(b.quantity.toString()), 0),
      },
    ]),
  )
}

/** Throws unless every id is an active variation of this company. Returns the info map. */
export async function assertVariations(db: Reader, companyId: string, ids: string[]) {
  const map = await variationInfo(db, companyId, ids)
  for (const id of ids) {
    const v = map.get(id)
    if (!v) throw notFound("Product")
    if (!v.active) throw businessRule(`${v.label} is inactive`)
  }
  return map
}

/** id → {name, code} for every branch of the company (including inactive, for history). */
export async function branchMap(db: Reader, companyId: string) {
  const rows = await db.branch.findMany({ where: { companyId }, select: { id: true, name: true, code: true, status: true } })
  return new Map(rows.map((b) => [b.id, b]))
}

/** Branch row (for numbering) — must be in the user's scope. */
export function scopedBranch(ctx: TenantContext, branchId: string) {
  const b = ctx.branches.find((x) => x.id === branchId)
  if (!b) throw businessRule("You do not have access to this branch")
  return b
}

/** yyyy-mm-dd → Date at UTC midnight (for @db.Date columns). */
export const toDateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`)

/** Timestamp for a stock movement dated `s`: now when it is today, otherwise midday of that day (keeps FIFO order sensible). */
export function movementTime(s: string) {
  return s === todayLocal() ? new Date() : new Date(`${s}T12:00:00`)
}

/** Today as yyyy-mm-dd in server local time (default for date inputs). */
export function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** readListParams() for API route handlers (query string → same shape pages use). */
export function listArgsFromRequest(req: Request, opts: { sortable: string[]; defaultSort: string }) {
  const sp = new URL(req.url).searchParams
  const p = readListParams(Object.fromEntries(sp.entries()), opts)
  return { ...p, sp }
}

/** List `meta` for API envelopes. */
export const listMeta = (p: { page: number; limit: number }, total: number) => ({
  page: p.page,
  limit: p.limit,
  total,
  pages: Math.max(1, Math.ceil(total / p.limit)),
})

/** ISO date string (yyyy-mm-dd) for client props. */
export const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
