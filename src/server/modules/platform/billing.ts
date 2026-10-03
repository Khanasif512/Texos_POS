import "server-only"
import { prisma } from "@/server/db"
import { audit } from "@/server/audit"
import { businessRule, notFound } from "@/server/errors"
import { dec, num } from "@/server/decimal"
import { layout, sendMail } from "@/server/mail"
import type { Prisma } from "@/generated/prisma/client"
import type { AdminContext } from "@/server/auth/admin-context"
import type { TenantContext } from "@/server/auth/context"
import { date, money } from "@/lib/format"
import {
  activationPeriod,
  addPeriod,
  DAY_MS,
  downgradeBlockers,
  planChangeKind,
  priceFor,
  retentionEndsAt,
  type Cycle,
  type InvoiceKind,
  type Usage,
} from "./lifecycle"
import { getBillingSettings, getPlatformSetting, PLATFORM_SETTINGS } from "./settings"

type Tx = Prisma.TransactionClient

// ───────────────────────────── Provider abstraction (MASTER_PROMPT §5) ─────────────────────────────

export type CheckoutInvoice = { id: string; number: string; amount: string; currency: string; description: string | null; companyName: string }
/** Either send the user to a hosted payment page or show them how to pay. */
export type CheckoutResult = { provider: string; redirectUrl?: string; instructions?: string }
export type VerifyResult = { status: "pending" | "paid" | "failed"; reference: string | null }

/**
 * A payment gateway. v1 ships `manual` (bank transfer / bKash, confirmed by the super admin);
 * SSLCommerz / bKash checkout / Stripe implement the same two calls: `createCheckout` returns the
 * hosted-page URL, `verify` validates the callback/IPN (or a submitted reference) server-side.
 */
export interface BillingProvider {
  readonly name: string
  readonly label: string
  createCheckout(invoice: CheckoutInvoice): Promise<CheckoutResult>
  verify(input: { invoice: CheckoutInvoice; reference?: string | null; payload?: unknown }): Promise<VerifyResult>
}

const fillTemplate = (text: string, inv: CheckoutInvoice) =>
  text
    .replaceAll("{invoice}", inv.number)
    .replaceAll("{amount}", money(inv.amount))
    .replaceAll("{company}", inv.companyName)

export const manualProvider: BillingProvider = {
  name: "manual",
  label: "Bank transfer / bKash",
  async createCheckout(invoice) {
    const text = await getPlatformSetting(PLATFORM_SETTINGS.instructions.key, PLATFORM_SETTINGS.instructions.fallback as string)
    return { provider: "manual", instructions: fillTemplate(text, invoice) }
  },
  // Nothing to verify automatically: the reference is recorded and a super admin confirms the payment.
  async verify({ reference }) {
    return { status: "pending", reference: reference ?? null }
  },
}

const PROVIDERS: Record<string, BillingProvider> = { [manualProvider.name]: manualProvider }

export function billingProvider(name = process.env.BILLING_PROVIDER || "manual"): BillingProvider {
  return PROVIDERS[name] ?? manualProvider
}

// ───────────────────────────── Numbers & invoice metadata ─────────────────────────────

/** Platform-wide billing invoice number, e.g. TXB-2026-00001 (Sequence row with companyId "platform"). */
export async function nextBillingNumber(tx: Tx, at = new Date()) {
  const year = at.getFullYear()
  const where = { companyId_scope_key_year: { companyId: "platform", scope: "platform", key: "TXB", year } }
  let row
  try {
    row = await tx.sequence.upsert({
      where,
      create: { companyId: "platform", scope: "platform", key: "TXB", year, next: 2 },
      update: { next: { increment: 1 } },
    })
  } catch {
    row = await tx.sequence.update({ where, data: { next: { increment: 1 } } })
  }
  return `TXB-${year}-${String(row.next - 1).padStart(5, "0")}`
}

/** What an invoice buys. Kept on the invoice's "create" audit entry (BillingInvoice has no plan column yet). */
export type InvoiceMeta = { kind: InvoiceKind; planId: string | null; planName: string | null; cycle: Cycle }

const META_ENTITY = "billing_invoice"

function invoiceAuditData(meta: InvoiceMeta, inv: { number: string; amount: Prisma.Decimal; companyId: string }) {
  return {
    action: "create",
    entityType: META_ENTITY,
    summary: `Billing invoice ${inv.number} · ${money(inv.amount)}${meta.planName ? ` · ${meta.planName} (${meta.cycle})` : ""}`,
    after: { ...meta, number: inv.number, amount: num(inv.amount) },
  }
}

export async function readInvoiceMetas(ids: string[], db: Tx | typeof prisma = prisma) {
  if (!ids.length) return new Map<string, InvoiceMeta>()
  const rows = await db.auditLog.findMany({ where: { entityType: META_ENTITY, action: "create", entityId: { in: ids } } })
  const map = new Map<string, InvoiceMeta>()
  for (const r of rows) {
    const a = r.after as Partial<InvoiceMeta> | null
    if (a?.kind && r.entityId) map.set(r.entityId, { kind: a.kind, planId: a.planId ?? null, planName: a.planName ?? null, cycle: a.cycle ?? "monthly" })
  }
  return map
}

/** Audit entry written by the billing job (no human actor). */
export async function systemAudit(
  db: Tx | typeof prisma,
  companyId: string | null,
  entry: { action: string; entityType: string; entityId?: string; summary: string; after?: unknown },
) {
  await db.auditLog.create({
    data: {
      companyId,
      actorType: "admin",
      actorId: null,
      actorName: "System",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 255),
      after: entry.after === undefined ? undefined : JSON.parse(JSON.stringify(entry.after)),
    },
  })
}

// ───────────────────────────── Notifications ─────────────────────────────

const appUrl = () => process.env.APP_URL || "http://localhost:3000"

/** Email the company (+ owners) and drop an in-app notification for the owner. */
export async function notifyCompany(
  companyId: string,
  msg: { type: string; subject: string; title: string; lines: string[]; link?: string },
  db: Tx | typeof prisma = prisma,
) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { email: true, users: { where: { isOwner: true, status: "active" }, select: { id: true, email: true } } },
  })
  if (!company) return
  const link = msg.link ?? "/app/settings/billing"
  await db.notification.create({
    data: { companyId, userId: company.users[0]?.id ?? null, type: msg.type, title: msg.title.slice(0, 191), body: msg.lines.join("\n"), link },
  })
  const to = [...new Set([company.email, ...company.users.map((u) => u.email)].map((e) => e.toLowerCase()))].join(", ")
  const url = `${appUrl()}${link}`
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const html = layout(
    esc(msg.title),
    `${msg.lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join("")}
<p style="margin:18px 0 0"><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Open billing</a></p>`,
  )
  // Mail failures must never roll back billing state; they are logged and retried by nobody (best effort).
  await sendMail({ to, subject: msg.subject, text: `${msg.lines.join("\n\n")}\n\n${url}`, html }).catch((e) =>
    console.error("[billing] mail failed", e),
  )
}

// ───────────────────────────── Usage ─────────────────────────────

export async function companyUsage(companyId: string): Promise<Usage> {
  const [branches, employees, products] = await Promise.all([
    prisma.branch.count({ where: { companyId, status: "active" } }),
    prisma.user.count({ where: { companyId, status: "active" } }),
    prisma.product.count({ where: { companyId, status: "active" } }),
  ])
  return { branches, employees, products }
}

async function currentSubscription(companyId: string, db: Tx | typeof prisma = prisma) {
  const sub = await db.subscription.findFirst({ where: { companyId, isCurrent: true }, include: { plan: true } })
  if (!sub) throw notFound("Subscription")
  return sub
}

function checkoutView(inv: { id: string; number: string; amount: Prisma.Decimal; currency: string; description: string | null }, companyName: string): CheckoutInvoice {
  return { id: inv.id, number: inv.number, amount: inv.amount.toFixed(2), currency: inv.currency, description: inv.description, companyName }
}

export const cycleLabel = (c: Cycle) => (c === "yearly" ? "Yearly" : "Monthly")

/** Void earlier unpaid invoices of these kinds (a new plan choice / a payment supersedes them). */
async function voidSuperseded(tx: Tx, companyId: string, kinds: InvoiceKind[], exceptId?: string) {
  const unpaid = await tx.billingInvoice.findMany({ where: { companyId, status: "unpaid", ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })
  const metas = await readInvoiceMetas(unpaid.map((u) => u.id), tx)
  const ids = unpaid.filter((u) => kinds.includes(metas.get(u.id)?.kind ?? "renewal")).map((u) => u.id)
  if (ids.length) await tx.billingInvoice.updateMany({ where: { id: { in: ids } }, data: { status: "void" } })
  return ids.length
}

// ───────────────────────────── Tenant actions ─────────────────────────────

/** §7: owner picks a plan → unpaid invoice + payment instructions. Plan switches when the payment is confirmed. */
export async function createPlanInvoice(ctx: TenantContext, input: { planId: string; cycle: Cycle }) {
  const [plan, sub, usage, settings] = await Promise.all([
    prisma.plan.findUnique({ where: { id: input.planId } }),
    currentSubscription(ctx.companyId),
    companyUsage(ctx.companyId),
    getBillingSettings(),
  ])
  if (!plan || plan.status !== "active" || (!plan.isPublic && plan.id !== sub.planId)) throw notFound("Plan")
  const paidUp = sub.status === "active" && !sub.cancelledAt
  if (paidUp && sub.planId === plan.id && sub.billingCycle === input.cycle)
    throw businessRule(`You are already on the ${plan.name} plan (${input.cycle}).`)
  const blockers = downgradeBlockers(usage, plan)
  if (blockers.length)
    throw businessRule(`Your current usage is above the ${plan.name} plan's limits. ${blockers.map((b) => b.message).join(" ")}`, { blockers })

  const amount = dec(priceFor(plan, input.cycle))
  if (amount.lte(0)) throw businessRule("This plan has no price set. Please contact sales.")
  const now = new Date()
  const kind: InvoiceKind = sub.status === "trialing" || sub.status === "expired" ? "new" : "change"
  const meta: InvoiceMeta = { kind, planId: plan.id, planName: plan.name, cycle: input.cycle }

  const inv = await prisma.$transaction(async (tx) => {
    await voidSuperseded(tx, ctx.companyId, ["new", "change"])
    const number = await nextBillingNumber(tx, now)
    const created = await tx.billingInvoice.create({
      data: {
        companyId: ctx.companyId,
        subscriptionId: sub.id,
        number,
        description: `${plan.name} plan · ${cycleLabel(input.cycle)}`,
        amount,
        status: "unpaid",
        // provisional: the real period starts when the payment is confirmed
        periodStart: now,
        periodEnd: addPeriod(now, input.cycle),
        issuedAt: now,
        dueAt: new Date(now.getTime() + Math.max(1, settings.graceDays) * DAY_MS),
        provider: billingProvider().name,
      },
    })
    await audit(ctx, { ...invoiceAuditData(meta, created), entityId: created.id }, tx)
    return created
  })

  const checkout = await billingProvider().createCheckout(checkoutView(inv, ctx.company.name))
  await notifyCompany(ctx.companyId, {
    type: "billing.invoice_issued",
    subject: `Invoice ${inv.number} — ${plan.name} plan`,
    title: `Invoice ${inv.number} issued`,
    lines: [
      `Thank you for choosing the ${plan.name} plan (${input.cycle}).`,
      `Amount due: ${money(inv.amount)} by ${date(inv.dueAt)}.`,
      ...(checkout.instructions ? [checkout.instructions] : []),
    ],
  })
  return { invoice: { id: inv.id, number: inv.number, amount: num(inv.amount), dueAt: inv.dueAt }, checkout }
}

export async function invoiceForTenant(ctx: TenantContext, id: string) {
  const inv = await prisma.billingInvoice.findFirst({ where: { id, companyId: ctx.companyId } })
  if (!inv) throw notFound("Invoice")
  const checkout = inv.status === "unpaid" ? await billingProvider(inv.provider).createCheckout(checkoutView(inv, ctx.company.name)) : null
  return { invoice: { ...inv, amount: num(inv.amount) }, checkout }
}

/** "I have paid": records the transaction reference; the invoice stays unpaid until the platform confirms it. */
export async function submitPaymentReference(ctx: TenantContext, id: string, reference: string) {
  const inv = await prisma.billingInvoice.findFirst({ where: { id, companyId: ctx.companyId } })
  if (!inv) throw notFound("Invoice")
  if (inv.status !== "unpaid") throw businessRule(`This invoice is ${inv.status}; no payment is due.`)
  const provider = billingProvider(inv.provider)
  const result = await provider.verify({ invoice: checkoutView(inv, ctx.company.name), reference })
  await prisma.billingInvoice.update({ where: { id }, data: { paymentReference: reference } })
  await audit(ctx, {
    action: "payment_reference",
    entityType: META_ENTITY,
    entityId: id,
    summary: `Payment reference ${reference} submitted for ${inv.number}`,
    before: { paymentReference: inv.paymentReference },
    after: { paymentReference: reference },
  })
  if (result.status === "paid") await activateInvoice(inv.id, { reference: result.reference ?? reference, actor: { tenant: ctx } })
  else {
    const admin = process.env.SUPER_ADMIN_EMAIL
    if (admin)
      await sendMail({
        to: admin,
        subject: `Payment to confirm: ${inv.number} (${ctx.company.name})`,
        text: `${ctx.company.name} reports paying ${money(inv.amount)} for ${inv.number}.\nReference: ${reference}\n\nConfirm it at ${appUrl()}/admin/billing?q=${inv.number}`,
      }).catch((e) => console.error("[billing] mail failed", e))
  }
  return { status: result.status }
}

/** Auto-renew toggle, cancel (NFR-CMP-02 retention) and resume. */
export async function updateSubscription(ctx: TenantContext, action: { action: "auto_renew"; autoRenew: boolean } | { action: "cancel" } | { action: "resume" }) {
  const sub = await currentSubscription(ctx.companyId)
  const now = new Date()
  if (action.action === "auto_renew") {
    if (sub.status === "cancelled" || sub.cancelledAt) throw businessRule("Resume the subscription before turning on auto-renew.")
    await prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: action.autoRenew } })
    await audit(ctx, { action: "auto_renew", entityType: "subscription", entityId: sub.id, summary: `Auto-renew turned ${action.autoRenew ? "on" : "off"}` })
    return { message: `Auto-renew ${action.autoRenew ? "on" : "off"}` }
  }

  if (action.action === "cancel") {
    if (sub.status === "cancelled" || sub.cancelledAt) throw businessRule("The subscription is already cancelled.")
    // A paid-up period keeps working until it ends; anything else stops now.
    const keepsPeriod = sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: keepsPeriod ? { cancelledAt: now, autoRenew: false } : { status: "cancelled", cancelledAt: now, autoRenew: false },
      })
      if (!keepsPeriod) await tx.company.update({ where: { id: ctx.companyId }, data: { status: "cancelled" } })
      await voidSuperseded(tx, ctx.companyId, ["new", "change", "renewal"])
      await audit(ctx, { action: "cancel", entityType: "subscription", entityId: sub.id, summary: keepsPeriod ? `Cancellation scheduled for ${date(sub.currentPeriodEnd)}` : "Subscription cancelled" }, tx)
    })
    const retention = retentionEndsAt({ cancelledAt: now, currentPeriodEnd: keepsPeriod ? sub.currentPeriodEnd : null })
    await notifyCompany(ctx.companyId, {
      type: "billing.cancelled",
      subject: "Your TexonPOS subscription is cancelled",
      title: "Subscription cancelled",
      lines: [
        keepsPeriod
          ? `Your ${sub.plan.name} plan stays fully usable until ${date(sub.currentPeriodEnd)}. It will not renew.`
          : "Your workspace is now read-only.",
        `Your data stays available read-only (and exportable) until ${date(retention)}. Resume or choose a plan at any time before then.`,
      ],
    })
    return { message: keepsPeriod ? `Cancels on ${date(sub.currentPeriodEnd)}` : "Subscription cancelled", retentionEndsAt: retention }
  }

  // resume
  if (sub.status === "active" && sub.cancelledAt) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { cancelledAt: null, autoRenew: true } })
    await audit(ctx, { action: "resume", entityType: "subscription", entityId: sub.id, summary: "Cancellation withdrawn" })
    return { message: "Subscription resumed" }
  }
  if (sub.status === "cancelled" && sub.trialEndsAt && sub.trialEndsAt > now && !(await hasPaidInvoice(ctx.companyId))) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: sub.id }, data: { status: "trialing", cancelledAt: null, autoRenew: true } })
      await tx.company.update({ where: { id: ctx.companyId }, data: { status: "trial" } })
      await audit(ctx, { action: "resume", entityType: "subscription", entityId: sub.id, summary: "Trial resumed" }, tx)
    })
    return { message: "Trial resumed" }
  }
  throw businessRule("Choose a plan below to reactivate your subscription.")
}

const hasPaidInvoice = async (companyId: string) => !!(await prisma.billingInvoice.findFirst({ where: { companyId, status: "paid" }, select: { id: true } }))

// ───────────────────────────── Platform (super admin) actions ─────────────────────────────

type Actor = { admin: AdminContext } | { tenant: TenantContext }

/**
 * Marks an invoice paid and, when it is for a plan, activates the subscription: plan = invoice plan,
 * status active, period from the billing cycle, grace cleared, company active. One transaction.
 */
export async function activateInvoice(id: string, opts: { reference?: string | null; paidAt?: Date; actor: Actor }) {
  const paidAt = opts.paidAt ?? new Date()
  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.billingInvoice.findUnique({ where: { id }, include: { company: { select: { id: true, name: true, status: true } } } })
    if (!inv) throw notFound("Invoice")
    if (inv.status !== "unpaid" && inv.status !== "failed") throw businessRule(`Invoice ${inv.number} is already ${inv.status}.`)
    const meta = (await readInvoiceMetas([id], tx)).get(id) ?? null
    const sub = await tx.subscription.findFirst({ where: { companyId: inv.companyId, isCurrent: true }, include: { plan: true } })

    let activated: { planName: string; start: Date; end: Date } | null = null
    if (sub && meta?.planId) {
      const plan = await tx.plan.findUnique({ where: { id: meta.planId } })
      if (!plan) throw notFound("Plan on this invoice")
      const period = activationPeriod(meta.kind, inv, paidAt, meta.cycle)
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          planId: plan.id,
          status: "active",
          billingCycle: meta.cycle,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          graceEndsAt: null,
          cancelledAt: null,
          autoRenew: sub.status === "cancelled" || sub.cancelledAt ? true : sub.autoRenew,
        },
      })
      if (inv.company.status !== "suspended") await tx.company.update({ where: { id: inv.companyId }, data: { status: "active" } })
      await tx.billingInvoice.update({ where: { id }, data: { periodStart: period.start, periodEnd: period.end } })
      activated = { planName: plan.name, start: period.start, end: period.end }
    }
    await tx.billingInvoice.update({
      where: { id },
      data: { status: "paid", paidAt, provider: inv.provider || "manual", paymentReference: opts.reference || inv.paymentReference },
    })
    const voided = activated ? await voidSuperseded(tx, inv.companyId, ["new", "change", "renewal"], id) : 0
    const entry = {
      action: "mark_paid",
      entityType: META_ENTITY,
      entityId: id,
      summary: `${inv.number} marked paid${activated ? ` — ${activated.planName} active until ${date(activated.end)}` : ""}${voided ? ` (${voided} superseded invoice${voided > 1 ? "s" : ""} voided)` : ""}`,
      before: { status: inv.status },
      after: { status: "paid", paidAt, reference: opts.reference || inv.paymentReference },
    }
    if ("admin" in opts.actor) await audit({ admin: opts.actor.admin, companyId: inv.companyId }, entry, tx)
    else await audit(opts.actor.tenant, entry, tx)
    return { inv, activated }
  })

  const { inv, activated } = result
  await notifyCompany(inv.companyId, {
    type: "billing.activated",
    subject: activated ? `Your ${activated.planName} plan is active` : `Payment received for ${inv.number}`,
    title: activated ? "Subscription activated" : "Payment received",
    lines: [
      `We received ${money(inv.amount)} for invoice ${inv.number}. Thank you!`,
      ...(activated ? [`Your ${activated.planName} plan is active from ${date(activated.start)} to ${date(activated.end)}.`] : []),
    ],
  })
  return activated
}

export async function markInvoiceFailed(admin: AdminContext, id: string) {
  const inv = await prisma.billingInvoice.findUnique({ where: { id } })
  if (!inv) throw notFound("Invoice")
  if (inv.status !== "unpaid") throw businessRule(`Only unpaid invoices can be marked failed (this one is ${inv.status}).`)
  await prisma.billingInvoice.update({ where: { id }, data: { status: "failed" } })
  await audit({ admin, companyId: inv.companyId }, { action: "mark_failed", entityType: META_ENTITY, entityId: id, summary: `${inv.number} marked failed`, before: { status: inv.status }, after: { status: "failed" } })
  await notifyCompany(inv.companyId, {
    type: "billing.payment_failed",
    subject: `Payment for ${inv.number} could not be confirmed`,
    title: "Payment not confirmed",
    lines: [`We could not confirm your payment of ${money(inv.amount)} for ${inv.number}${inv.paymentReference ? ` (reference ${inv.paymentReference})` : ""}.`, "Please check the reference or contact support."],
  })
}

export async function voidInvoice(admin: AdminContext, id: string) {
  const inv = await prisma.billingInvoice.findUnique({ where: { id } })
  if (!inv) throw notFound("Invoice")
  if (inv.status === "paid" || inv.status === "void") throw businessRule(`A ${inv.status} invoice cannot be voided.`)
  await prisma.billingInvoice.update({ where: { id }, data: { status: "void" } })
  await audit({ admin, companyId: inv.companyId }, { action: "void", entityType: META_ENTITY, entityId: id, summary: `${inv.number} voided`, before: { status: inv.status }, after: { status: "void" } })
}

export async function createManualInvoice(
  admin: AdminContext,
  input: { companyId: string; planId: string | null; cycle: Cycle; amount: number; description: string; dueDays: number },
) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true, name: true } })
  if (!company) throw notFound("Company")
  const plan = input.planId ? await prisma.plan.findUnique({ where: { id: input.planId } }) : null
  if (input.planId && !plan) throw notFound("Plan")
  const sub = await prisma.subscription.findFirst({ where: { companyId: company.id, isCurrent: true } })
  const now = new Date()
  const meta: InvoiceMeta = { kind: "manual", planId: plan?.id ?? null, planName: plan?.name ?? null, cycle: input.cycle }
  const inv = await prisma.$transaction(async (tx) => {
    const number = await nextBillingNumber(tx, now)
    const created = await tx.billingInvoice.create({
      data: {
        companyId: company.id,
        subscriptionId: sub?.id ?? null,
        number,
        description: input.description,
        amount: dec(input.amount),
        status: "unpaid",
        periodStart: plan ? now : null,
        periodEnd: plan ? addPeriod(now, input.cycle) : null,
        issuedAt: now,
        dueAt: new Date(now.getTime() + input.dueDays * DAY_MS),
        provider: "manual",
      },
    })
    await audit({ admin, companyId: company.id }, { ...invoiceAuditData(meta, created), entityId: created.id }, tx)
    return created
  })
  const checkout = await manualProvider.createCheckout(checkoutView(inv, company.name))
  await notifyCompany(company.id, {
    type: "billing.invoice_issued",
    subject: `Invoice ${inv.number} from TexonPOS`,
    title: `Invoice ${inv.number} issued`,
    lines: [`${input.description}: ${money(inv.amount)} due by ${date(inv.dueAt)}.`, checkout.instructions ?? ""].filter(Boolean),
  })
  return { id: inv.id, number: inv.number }
}

// ───────────────────────────── Tenant billing summary (page + GET /api/v1/billing) ─────────────────────────────

export async function billingSummary(ctx: TenantContext) {
  const [sub, usage, plans, invoices] = await Promise.all([
    prisma.subscription.findFirst({ where: { companyId: ctx.companyId, isCurrent: true }, include: { plan: true } }),
    companyUsage(ctx.companyId),
    prisma.plan.findMany({ where: { status: "active", isPublic: true }, orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }] }),
    prisma.billingInvoice.findMany({ where: { companyId: ctx.companyId }, orderBy: { issuedAt: "desc" }, take: 50 }),
  ])
  if (sub && !plans.some((p) => p.id === sub.planId)) plans.push(sub.plan)
  const paidUp = !!sub && sub.status === "active"
  const current = sub ? { planId: sub.planId, cycle: sub.billingCycle, priceMonthly: num(sub.plan.priceMonthly), paid: paidUp && !sub.cancelledAt } : null
  return {
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          planId: sub.planId,
          planName: sub.plan.name,
          billingCycle: sub.billingCycle,
          trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
          currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          graceEndsAt: sub.graceEndsAt?.toISOString() ?? null,
          autoRenew: sub.autoRenew,
          cancelledAt: sub.cancelledAt?.toISOString() ?? null,
          retentionEndsAt: retentionEndsAt(sub)?.toISOString() ?? null,
          paidUp,
          priceMonthly: num(sub.plan.priceMonthly),
        }
      : null,
    usage,
    plans: plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      tagline: p.tagline,
      priceMonthly: num(p.priceMonthly),
      priceYearly: num(p.priceYearly),
      maxBranches: p.maxBranches,
      maxEmployees: p.maxEmployees,
      maxProducts: p.maxProducts,
      features: p.features as Record<string, boolean>,
      blockers: downgradeBlockers(usage, p),
      change: {
        monthly: planChangeKind(current, { id: p.id, priceMonthly: num(p.priceMonthly) }, "monthly"),
        yearly: planChangeKind(current, { id: p.id, priceMonthly: num(p.priceMonthly) }, "yearly"),
      },
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      description: i.description,
      amount: num(i.amount),
      status: i.status,
      issuedAt: i.issuedAt.toISOString(),
      dueAt: i.dueAt?.toISOString() ?? null,
      paidAt: i.paidAt?.toISOString() ?? null,
      periodStart: i.periodStart?.toISOString() ?? null,
      periodEnd: i.periodEnd?.toISOString() ?? null,
      paymentReference: i.paymentReference,
    })),
  }
}
export type BillingSummary = Awaited<ReturnType<typeof billingSummary>>
