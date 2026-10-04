"use client"

import Link from "next/link"
import { differenceInCalendarDays } from "date-fns"
import { AlertTriangle, Clock, ShieldAlert } from "lucide-react"
import { useT } from "@/components/i18n/i18n-provider"
import type { MessageKey } from "@/lib/i18n"
import { canClient, useApp } from "./app-context"

/** English read-only reasons produced by src/server/auth/context.ts → translation keys. */
const REASONS: Record<string, MessageKey> = {
  "Your workspace has been suspended. Please contact support.": "banner.reason.suspended",
  "Your subscription is cancelled. Data is read-only.": "banner.reason.cancelled",
  "Your free trial has ended. Choose a plan to continue.": "banner.reason.trialEnded",
  "Payment is overdue. Settle your invoice to restore full access.": "banner.reason.pastDue",
  "Your subscription is not active.": "banner.reason.inactive",
}

export function AppBanners() {
  const ctx = useApp()
  const t = useT()
  const canBilling = canClient(ctx, "settings.billing")
  if (ctx.impersonating)
    return (
      <div className="flex items-center justify-center gap-2 bg-warning/20 px-4 py-2 text-xs font-medium text-foreground">
        <ShieldAlert className="size-4 shrink-0" /> {t("banner.impersonating")}
      </div>
    )
  if (ctx.readOnly) {
    const key = ctx.readOnlyReason ? REASONS[ctx.readOnlyReason] : undefined
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 bg-destructive/10 px-4 py-2 text-center text-xs font-medium text-destructive">
        <AlertTriangle className="size-4 shrink-0" /> {key ? t(key) : ctx.readOnlyReason} {t("banner.readOnly")}
        {canBilling && (
          <Link href="/app/settings/billing" className="underline underline-offset-2">
            {t("banner.manageSubscription")}
          </Link>
        )}
      </div>
    )
  }
  if (ctx.subscription?.status === "trialing" && ctx.subscription.trialEndsAt) {
    const days = Math.max(0, differenceInCalendarDays(new Date(ctx.subscription.trialEndsAt), new Date()))
    const plan = ctx.plan.name
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-xs font-medium text-accent-foreground">
        <Clock className="size-3.5 shrink-0" />
        {days === 0 ? t("banner.trialToday", { plan }) : days === 1 ? t("banner.trialOne", { plan }) : t("banner.trialMany", { plan, days })}
        {canBilling && (
          <Link href="/app/settings/billing" className="underline underline-offset-2">
            {t("banner.choosePlan")}
          </Link>
        )}
      </div>
    )
  }
  return null
}
