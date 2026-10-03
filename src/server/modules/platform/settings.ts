// No "server-only" import: provision.ts (also run by prisma/seed.ts via tsx) reads the trial length from here.
import type { Prisma, PrismaClient } from "@/generated/prisma/client"

type SettingDb = Pick<PrismaClient, "platformSetting"> | Prisma.TransactionClient

export const DEFAULT_BILLING_INSTRUCTIONS = `Pay the invoice amount by bank transfer or bKash and quote the invoice number {invoice} as reference.

Bank: Dutch-Bangla Bank PLC, Gulshan Branch
Account name: Texon Technologies Ltd.
Account no: 123.110.0045678

bKash (Merchant): 01700-000000 — use "Payment", reference {invoice}

After paying, click "I have paid" and enter the transaction ID. Your plan is activated as soon as we confirm the payment (usually within one business day).`

/** Platform-wide settings editable at /admin/settings (stored as PlatformSetting rows). */
export const PLATFORM_SETTINGS = {
  trialDays: { key: "billing.trialDays", fallback: 14 },
  graceDays: { key: "billing.graceDays", fallback: 7 },
  instructions: { key: "billing.instructions", fallback: DEFAULT_BILLING_INSTRUCTIONS },
} as const

/**
 * Reads a PlatformSetting value, falling back when the row is missing or holds a value of another type.
 * Pass `db` inside a transaction (or from the seed); otherwise the shared client is used.
 */
export async function getPlatformSetting<T extends string | number | boolean>(key: string, fallback: T, db?: SettingDb): Promise<T> {
  const client = db ?? (await import("@/server/db")).prisma
  const row = await client.platformSetting.findUnique({ where: { key } })
  const v = row?.value as unknown
  return typeof v === typeof fallback ? (v as T) : fallback
}

export async function getBillingSettings(db?: SettingDb) {
  const [trialDays, graceDays, instructions] = await Promise.all([
    getPlatformSetting(PLATFORM_SETTINGS.trialDays.key, PLATFORM_SETTINGS.trialDays.fallback as number, db),
    getPlatformSetting(PLATFORM_SETTINGS.graceDays.key, PLATFORM_SETTINGS.graceDays.fallback as number, db),
    getPlatformSetting(PLATFORM_SETTINGS.instructions.key, PLATFORM_SETTINGS.instructions.fallback as string, db),
  ])
  return { trialDays, graceDays, instructions }
}
