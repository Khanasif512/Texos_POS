"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNowStrict } from "date-fns"
import { bn as bnLocale } from "date-fns/locale"
import { Bell, CreditCard, PackageMinus, Receipt, Ship, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n/i18n-provider"
import { api, errorMessage } from "@/lib/api-client"
import { dateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MessageKey } from "@/lib/i18n"
import type { NotificationItem } from "@/server/modules/notifications/service"

export type { NotificationItem }
export type NotificationsPage = {
  items: NotificationItem[]
  total: number
  unread: number
  page: number
  limit: number
  hasMore: boolean
}

/** Root query key — invalidating it refreshes the bell and the notifications page together. */
export const NOTIFICATIONS_KEY = ["notifications"] as const

type Meta = { icon: LucideIcon; tone: string; label: MessageKey }

const META: Record<string, Meta> = {
  low_stock: { icon: PackageMinus, tone: "bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_25%)] dark:text-warning", label: "notif.type.low_stock" },
  lc_arrival: { icon: Ship, tone: "bg-info/12 text-info", label: "notif.type.lc_arrival" },
  credit_overdue: { icon: Receipt, tone: "bg-destructive/10 text-destructive", label: "notif.type.credit_overdue" },
  subscription: { icon: CreditCard, tone: "bg-primary/10 text-primary", label: "notif.type.subscription" },
}
const GENERAL: Meta = { icon: Bell, tone: "bg-muted text-muted-foreground", label: "notif.type.general" }

export const typeMeta = (type: string): Meta => META[type] ?? (type.startsWith("billing.") ? META.subscription! : GENERAL)

export function NotificationIcon({ type, className }: { type: string; className?: string }) {
  const m = typeMeta(type)
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", m.tone, className)}>
      <m.icon className="size-4" />
    </span>
  )
}

/** "5 minutes ago" / "৫ মিনিট আগে", re-rendered every minute. */
export function RelativeTime({ iso }: { iso: string }) {
  const { lang, t } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const d = new Date(iso)
  const label =
    now - d.getTime() < 60_000 ? t("common.justNow") : formatDistanceToNowStrict(d, { addSuffix: true, locale: lang === "bn" ? bnLocale : undefined })
  return (
    <time dateTime={iso} title={dateTime(d)} className="whitespace-nowrap">
      {label}
    </time>
  )
}

/** Mark ids (or everything) as read, then refresh every notifications query. */
export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { ids: string[] } | { all: true }) => api.post<{ updated: number }>("/api/v1/notifications/read", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    onError: (e) => toast.error(errorMessage(e)),
  })
}

/** One notification line, shared by the bell popover and the notifications page. */
export function NotificationRow({ n, compact, onNavigate }: { n: NotificationItem; compact?: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const { t } = useI18n()
  const markRead = useMarkRead()
  const open = () => {
    if (!n.read) markRead.mutate({ ids: [n.id] })
    if (n.link) {
      onNavigate?.()
      router.push(n.link)
    }
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}
      className={cn(
        "group relative flex w-full cursor-pointer gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
        !n.read && "bg-primary/[0.03]",
      )}
    >
      <NotificationIcon type={n.type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className={cn("min-w-0 flex-1 text-sm leading-snug", n.read ? "text-foreground/80" : "font-medium")}>{n.title}</p>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t("notif.filter.unread")} />}
        </div>
        {n.body && (
          <p className={cn("mt-0.5 text-xs whitespace-pre-line text-muted-foreground", compact && "line-clamp-2")}>{n.body}</p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{t(typeMeta(n.type).label)}</span>
          <span aria-hidden>·</span>
          <RelativeTime iso={n.createdAt} />
          {!compact && !n.read && (
            <button
              type="button"
              className="ml-auto font-medium text-primary transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                markRead.mutate({ ids: [n.id] })
              }}
            >
              {t("notif.markRead")}
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
