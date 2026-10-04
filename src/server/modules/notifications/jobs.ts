import "server-only"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { layout, sendMail } from "@/server/mail"
import { date, money, quantity } from "@/lib/format"
import { notify, loadRecipients } from "./service"
import {
  BILLING_PREFIX,
  DEDUP_WINDOW_MS,
  creditOverdueCutoff,
  digestDue,
  dueHorizon,
  lcArrivalState,
  mergeSettings,
  resolveSettings,
  subscriptionAlert,
  type Recipient,
} from "./rules"

const appUrl = () => process.env.APP_URL || "http://localhost:3000"
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export type JobResult = { companies: number; created: number; emails: number; errors: number }

/**
 * AUD-02 scheduled checks. Scans every active (or trialing) company and raises notifications for
 * low stock, LC arrivals, overdue credit invoices and subscription dates, honouring
 * Company.settings.notifications. Idempotent within 24h (notify() de-duplicates), so it is safe
 * to run hourly; the daily email digest is sent at most once per local calendar day.
 */
export async function runNotificationJobs(now = new Date(), opts: { companyId?: string } = {}): Promise<JobResult> {
  const companies = await prisma.company.findMany({
    where: { status: { in: ["trial", "active"] }, ...(opts.companyId ? { id: opts.companyId } : {}) },
    select: { id: true, name: true, timezone: true, settings: true },
  })
  const result: JobResult = { companies: 0, created: 0, emails: 0, errors: 0 }
  for (const c of companies) {
    try {
      const r = await runForCompany(c, now)
      result.created += r.created
      result.emails += r.emails
    } catch (e) {
      result.errors++
      console.error(`[notifications] job failed for company ${c.id}`, e)
    }
    result.companies++
  }
  return result
}

type CompanyRow = { id: string; name: string; timezone: string; settings: Prisma.JsonValue }

async function runForCompany(c: CompanyRow, now: Date) {
  const { prefs, creditDueDays, digestAt } = resolveSettings(c.settings)
  const tz = c.timezone || "Asia/Dhaka"
  const recipients = await loadRecipients(prisma, c.id)
  const branches = new Map(
    (await prisma.branch.findMany({ where: { companyId: c.id }, select: { id: true, name: true } })).map((b) => [b.id, b.name]),
  )
  let created = 0
  const send = async (input: Omit<Parameters<typeof notify>[1], "companyId">) => {
    created += await notify(prisma, { companyId: c.id, ...input }, { now, recipients })
  }

  if (prefs.lowStock) await lowStock(c.id, branches, send)
  if (prefs.lcArrival) await lcArrivals(c.id, tz, now, send)
  if (prefs.overdueCredit) await overdueCredit(c.id, creditDueDays, branches, now, send)
  if (prefs.subscription) await subscription(c.id, recipients, now, send)

  let emails = 0
  if (prefs.email && digestDue(digestAt, now, tz)) emails = await digest(c, recipients, digestAt, now, tz)
  return { created, emails }
}

type Send = (input: Omit<Parameters<typeof notify>[1], "companyId">) => Promise<void>

// ───────────────────────── low stock ─────────────────────────

type LowRow = {
  branchId: string
  quantity: { toString(): string }
  reorderLevel: { toString(): string }
  variationName: string
  sku: string
  productName: string
  unit: string
}

async function lowStock(companyId: string, branches: Map<string, string>, send: Send) {
  // Column-to-column comparison (quantity ≤ reorderLevel) needs SQL; grouped per branch.
  const rows = await prisma.$queryRaw<LowRow[]>`
    SELECT sb.branchId, sb.quantity, v.reorderLevel, v.name AS variationName, v.sku, p.name AS productName, p.unit
    FROM stock_balances sb
    JOIN product_variations v ON v.id = sb.variationId
    JOIN products p ON p.id = v.productId
    JOIN branches b ON b.id = sb.branchId
    WHERE sb.companyId = ${companyId}
      AND v.reorderLevel > 0 AND sb.quantity <= v.reorderLevel
      AND v.status = 'active' AND p.status = 'active' AND b.status = 'active'
    ORDER BY sb.branchId, sb.quantity / v.reorderLevel ASC, p.name ASC`
  const byBranch = new Map<string, LowRow[]>()
  for (const r of rows) byBranch.set(r.branchId, [...(byBranch.get(r.branchId) ?? []), r])

  for (const [branchId, items] of byBranch) {
    const branch = branches.get(branchId) ?? "a branch"
    const lines = items.slice(0, 5).map((r) => {
      const name = r.variationName && r.variationName !== r.productName ? `${r.productName} — ${r.variationName}` : r.productName
      return `• ${name} (${r.sku}): ${quantity(r.quantity.toString())} ${r.unit} left, reorder at ${quantity(r.reorderLevel.toString())}`
    })
    if (items.length > 5) lines.push(`…and ${items.length - 5} more`)
    await send({
      type: "low_stock",
      branchId,
      title: `${plural(items.length, "item")} low on stock at ${branch}`,
      body: lines.join("\n"),
      link: `/app/inventory/low-stock?branchId=${branchId}`,
    })
  }
}

// ───────────────────────── LC arrival ─────────────────────────

async function lcArrivals(companyId: string, tz: string, now: Date, send: Send) {
  const lcs = await prisma.lc.findMany({
    where: {
      companyId,
      status: { in: ["opened", "goods_in_transit"] },
      expectedArrivalDate: { not: null, lte: dueHorizon(now, tz) },
    },
    select: { id: true, lcNumber: true, branchId: true, status: true, expectedArrivalDate: true, supplier: { select: { name: true } } },
    orderBy: { expectedArrivalDate: "asc" },
  })
  for (const lc of lcs) {
    const s = lcArrivalState(lc.expectedArrivalDate, now, tz)
    if (!s) continue
    const title =
      s.kind === "overdue"
        ? `LC ${lc.lcNumber} arrival is ${plural(s.days, "day")} overdue`
        : s.kind === "today"
          ? `LC ${lc.lcNumber} is due to arrive today`
          : `LC ${lc.lcNumber} arrives in ${plural(s.days, "day")}`
    await send({
      type: "lc_arrival",
      branchId: lc.branchId,
      title,
      body: `${lc.supplier.name} · expected ${date(lc.expectedArrivalDate)} · ${lc.status === "goods_in_transit" ? "goods in transit" : "LC opened"}`,
      link: `/app/lc/${lc.id}`,
    })
  }
}

// ───────────────────────── overdue credit ─────────────────────────

async function overdueCredit(companyId: string, creditDueDays: number, branches: Map<string, string>, now: Date, send: Send) {
  const groups = await prisma.invoice.groupBy({
    by: ["branchId"],
    where: {
      companyId,
      type: "credit",
      status: { in: ["confirmed", "partially_returned"] },
      dueAmount: { gt: 0 },
      invoiceDate: { lt: creditOverdueCutoff(now, creditDueDays) },
    },
    _count: { _all: true },
    _sum: { dueAmount: true },
    _min: { invoiceDate: true },
  })
  for (const g of groups) {
    const branch = branches.get(g.branchId) ?? "a branch"
    await send({
      type: "credit_overdue",
      branchId: g.branchId,
      title: `${plural(g._count._all, "credit invoice")} overdue at ${branch}`,
      body: `${money(g._sum.dueAmount?.toString())} is still unpaid more than ${plural(creditDueDays, "day")} after invoicing. Oldest from ${date(g._min.invoiceDate)}.`,
      link: `/app/sales/invoices?type=credit&overdue=1&branchId=${g.branchId}`,
    })
  }
}

// ───────────────────────── subscription ─────────────────────────

async function subscription(companyId: string, recipients: Recipient[], now: Date, send: Send) {
  const sub = await prisma.subscription.findFirst({
    where: { companyId, isCurrent: true },
    include: { plan: { select: { name: true } } },
  })
  const alert = subscriptionAlert(sub, now)
  if (!sub || !alert) return
  // The platform billing job already sent a notice (billing.*) in the last day → don't double up.
  const recent = await prisma.notification.count({
    where: { companyId, type: { startsWith: BILLING_PREFIX }, createdAt: { gte: new Date(now.getTime() - DEDUP_WINDOW_MS) } },
  })
  if (recent) return

  const plan = sub.plan.name
  const msg =
    alert.kind === "trial_ending"
      ? { title: `Your free trial ends in ${plural(alert.days, "day")}`, body: `Choose a plan before ${date(sub.trialEndsAt)} to keep using the ${plan} plan without interruption.` }
      : alert.kind === "trial_ended"
        ? { title: "Your free trial has ended", body: "The workspace is read-only until you choose a plan." }
        : alert.kind === "renewal_due"
          ? {
              title: alert.days === 0 ? `Your ${plan} subscription renews today` : `Your ${plan} subscription renews in ${plural(alert.days, "day")}`,
              body: sub.autoRenew
                ? `The next billing period starts ${date(sub.currentPeriodEnd)}. Keep payment ready to avoid interruption.`
                : `Auto-renew is off. Renew before ${date(sub.currentPeriodEnd)} to keep full access.`,
            }
          : {
              title: "Subscription payment is overdue",
              body: sub.graceEndsAt ? `Settle your invoice before ${date(sub.graceEndsAt)} to keep full access.` : "Settle your invoice to keep full access.",
            }
  for (const owner of recipients.filter((u) => u.isOwner))
    await send({ type: "subscription", userId: owner.id, title: msg.title, body: msg.body, link: "/app/settings/billing" })
}

// ───────────────────────── daily email digest ─────────────────────────

async function digest(c: CompanyRow, recipients: Recipient[], last: Date | null, now: Date, tz: string) {
  // Claim today's digest under the settings row lock first, so concurrent runs never send twice.
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id = ${c.id} FOR UPDATE`
    const row = await tx.company.findUniqueOrThrow({ where: { id: c.id }, select: { settings: true } })
    if (!digestDue(resolveSettings(row.settings).digestAt, now, tz)) return false
    const settings = mergeSettings(row.settings, { notificationDigestAt: now.toISOString() }) as Prisma.InputJsonValue
    await tx.company.update({ where: { id: c.id }, data: { settings } })
    return true
  })
  if (!claimed) return 0

  const since = last && now.getTime() - last.getTime() < 2 * DEDUP_WINDOW_MS ? last : new Date(now.getTime() - DEDUP_WINDOW_MS)
  const rows = await prisma.notification.findMany({
    where: { companyId: c.id, createdAt: { gt: since }, NOT: { type: { startsWith: BILLING_PREFIX } } },
    orderBy: { createdAt: "desc" },
    select: { type: true, title: true, body: true, link: true },
    take: 500,
  })
  const seen = new Set<string>()
  const items = rows.filter((r) => {
    const k = `${r.type}|${r.link ?? ""}|${r.title}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const owners = recipients.filter((u) => u.isOwner)
  if (!items.length || !owners.length) return 0

  const shown = items.slice(0, 30)
  const subject = `${c.name}: ${plural(items.length, "alert")} today`
  const text = [
    `Daily summary for ${c.name}`,
    "",
    ...shown.map((i) => `- ${i.title}${i.link ? `\n  ${appUrl()}${i.link}` : ""}`),
    items.length > shown.length ? `…and ${items.length - shown.length} more` : "",
    "",
    `Manage alerts: ${appUrl()}/app/settings/notifications`,
  ].join("\n")
  const html = layout(
    esc(`Daily summary · ${c.name}`),
    `<ul style="padding-left:18px;margin:0 0 16px">${shown
      .map(
        (i) =>
          `<li style="margin:0 0 10px">${i.link ? `<a href="${appUrl()}${esc(i.link)}" style="color:#4f46e5;font-weight:600;text-decoration:none">${esc(i.title)}</a>` : `<strong>${esc(i.title)}</strong>`}${
            i.body ? `<br><span style="color:#5b6075;font-size:13px">${esc(i.body).replace(/\n/g, "<br>")}</span>` : ""
          }</li>`,
      )
      .join("")}</ul>${items.length > shown.length ? `<p style="margin:0 0 12px">…and ${items.length - shown.length} more.</p>` : ""}
<p style="margin:18px 0 0;font-size:12px;color:#8a8fa3">Change what you receive in <a href="${appUrl()}/app/settings/notifications" style="color:#4f46e5">notification settings</a>.</p>`,
  )
  let sent = 0
  for (const o of owners) {
    try {
      await sendMail({ to: o.email, subject, text, html })
      sent++
    } catch (e) {
      console.error("[notifications] digest mail failed", e)
    }
  }
  return sent
}
