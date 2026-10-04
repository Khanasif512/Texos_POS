import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import type { TenantContext } from "@/server/auth/context"
import { prisma } from "@/server/db"
import {
  BILLING_PERMISSION,
  BILLING_PREFIX,
  DEDUP_WINDOW_MS,
  hiddenTypesFor,
  isDuplicate,
  mergeSettings,
  pickRecipients,
  resolveSettings,
  type NotificationPrefs,
  type Recipient,
} from "./rules"

/** The raw client or an interactive-transaction client (`prisma.$transaction(async (tx) => …)`). */
export type NotifyDb = typeof prisma | Prisma.TransactionClient

export type NotifyInput = {
  companyId: string
  /** a specific user, or null/undefined for every eligible user (by type permission and branch access) */
  userId?: string | null
  type: string
  title: string
  body?: string | null
  link?: string | null
  /** limits broadcast recipients to users who can access this branch */
  branchId?: string | null
}

/** Active users of a company with their permission keys and branch scope. */
export async function loadRecipients(db: NotifyDb, companyId: string): Promise<Recipient[]> {
  const users = await db.user.findMany({
    where: { companyId, status: "active" },
    select: {
      id: true,
      name: true,
      email: true,
      isOwner: true,
      allBranches: true,
      role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
      branches: { select: { branchId: true } },
    },
  })
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isOwner: u.isOwner || u.role.key === "owner",
    allBranches: u.isOwner || u.role.key === "owner" || u.allBranches,
    permissions: u.role.permissions.map((p) => p.permission.key),
    branchIds: u.branches.map((b) => b.branchId),
  }))
}

/**
 * AUD-02: create an in-app notification. With `userId` null it fans out one row per eligible user
 * (so read state is per user). The same type+link is not repeated to a user within 24 hours.
 * Returns the number of rows created. Pass `tx` to write inside a business transaction.
 */
export async function notify(db: NotifyDb, input: NotifyInput, opts: { now?: Date; recipients?: Recipient[] } = {}): Promise<number> {
  const now = opts.now ?? new Date()
  const link = input.link ?? null
  const userIds = input.userId
    ? [input.userId]
    : pickRecipients(opts.recipients ?? (await loadRecipients(db, input.companyId)), input.type, input.branchId).map((u) => u.id)
  if (!userIds.length) return 0

  const existing = await db.notification.findMany({
    where: {
      companyId: input.companyId,
      type: input.type,
      link,
      userId: { in: userIds },
      createdAt: { gte: new Date(now.getTime() - DEDUP_WINDOW_MS) },
    },
    select: { userId: true, type: true, link: true, createdAt: true },
  })
  const fresh = userIds.filter((userId) => !isDuplicate(existing, { userId, type: input.type, link }, now))
  if (!fresh.length) return 0

  await db.notification.createMany({
    data: fresh.map((userId) => ({
      companyId: input.companyId,
      userId,
      type: input.type.slice(0, 60),
      title: input.title.slice(0, 191),
      body: input.body ?? null,
      link: link?.slice(0, 255) ?? null,
    })),
  })
  return fresh.length
}

// ───────────────────────── reading (current user) ─────────────────────────

type Viewer = Pick<TenantContext, "companyId" | "userId" | "isOwner" | "permissions">

/** Rows the user may see: their own, plus broadcast rows (userId = null) of types they are allowed to see. */
export function visibleWhere(ctx: Viewer): Prisma.NotificationWhereInput {
  const hidden = hiddenTypesFor(ctx)
  const canBilling = ctx.isOwner || ctx.permissions.has(BILLING_PERMISSION)
  return {
    companyId: ctx.companyId,
    OR: [
      { userId: ctx.userId },
      {
        userId: null,
        ...(hidden.length ? { type: { notIn: hidden } } : {}),
        ...(canBilling ? {} : { NOT: { type: { startsWith: BILLING_PREFIX } } }),
      },
    ],
  }
}

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

export async function listNotifications(ctx: Viewer, opts: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
  const base = visibleWhere(ctx)
  const where: Prisma.NotificationWhereInput = opts.unreadOnly ? { AND: [base, { readAt: null }] } : base
  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { AND: [base, { readAt: null }] } }),
  ])
  const items: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }))
  return { items, total, unread, page, limit, hasMore: page * limit < total }
}

/** Mark some (ids) or all visible notifications as read. Returns the number updated. */
export async function markRead(ctx: Viewer, input: { ids?: string[]; all?: boolean }) {
  if (!input.all && !input.ids?.length) return 0
  const r = await prisma.notification.updateMany({
    where: { AND: [visibleWhere(ctx), { readAt: null }, input.all ? {} : { id: { in: input.ids } }] },
    data: { readAt: new Date() },
  })
  return r.count
}

// ───────────────────────── company preferences ─────────────────────────

export async function getPreferences(companyId: string) {
  const c = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { settings: true } })
  const { prefs, creditDueDays } = resolveSettings(c.settings)
  return { ...prefs, creditDueDays }
}

/**
 * Read-modify-write of Company.settings under a row lock, so concurrent writers (other modules,
 * the digest job) never lose each other's keys. Returns the settings before and after.
 */
export async function updateCompanySettings(
  companyId: string,
  patch: Parameters<typeof mergeSettings>[1],
  inTx?: (tx: Prisma.TransactionClient, before: unknown, after: Record<string, unknown>) => Promise<void>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`
    const row = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { settings: true } })
    const after = mergeSettings(row.settings, patch)
    await tx.company.update({ where: { id: companyId }, data: { settings: after as Prisma.InputJsonValue } })
    if (inTx) await inTx(tx, row.settings, after)
    return { before: row.settings, after }
  })
}

export type PreferencesInput = NotificationPrefs & { creditDueDays: number }
