"use client"

import Link from "next/link"
import { differenceInCalendarDays } from "date-fns"
import { AlertTriangle, Clock, ShieldAlert } from "lucide-react"
import { useApp } from "./app-context"

export function AppBanners() {
  const ctx = useApp()
  if (ctx.impersonating)
    return (
      <div className="flex items-center justify-center gap-2 bg-warning/20 px-4 py-2 text-xs font-medium text-foreground">
        <ShieldAlert className="size-4" /> You are viewing this workspace as platform support. Actions are audit-logged.
      </div>
    )
  if (ctx.readOnly)
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
        <AlertTriangle className="size-4" /> {ctx.readOnlyReason} Workspace is read-only.
        {ctx.isOwner && (
          <Link href="/app/settings/billing" className="underline underline-offset-2">
            Manage subscription
          </Link>
        )}
      </div>
    )
  if (ctx.subscription?.status === "trialing" && ctx.subscription.trialEndsAt) {
    const days = differenceInCalendarDays(new Date(ctx.subscription.trialEndsAt), new Date())
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 bg-accent px-4 py-2 text-xs font-medium text-accent-foreground">
        <Clock className="size-3.5" /> {days} day{days === 1 ? "" : "s"} left in your free trial of the {ctx.plan.name} plan.
        {ctx.isOwner && (
          <Link href="/app/settings/billing" className="underline underline-offset-2">
            Choose a plan
          </Link>
        )}
      </div>
    )
  }
  return null
}
