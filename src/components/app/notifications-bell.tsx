"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Bell, CheckCheck, Loader2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/components/i18n/i18n-provider"
import { api } from "@/lib/api-client"
import { NOTIFICATIONS_KEY, NotificationRow, useMarkRead, type NotificationsPage } from "./notifications-shared"

/** Topbar bell: unread badge + latest notifications; polls every 60s (AUD-02). */
export function NotificationsBell() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const q = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, "bell"],
    queryFn: () => api.get<NotificationsPage>("/api/v1/notifications?limit=8"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  const markRead = useMarkRead()
  const unread = q.data?.unread ?? 0

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) void q.refetch()
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `${t("notif.title")} (${t("notif.unreadCount", { count: unread })})` : t("notif.title")}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="num absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[380px] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("notif.title")}</p>
            {unread > 0 && <p className="text-xs text-muted-foreground">{t("notif.unreadCount", { count: unread })}</p>}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" disabled={markRead.isPending} onClick={() => markRead.mutate({ all: true })}>
              {markRead.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
              {t("notif.markAllRead")}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" asChild aria-label={t("topbar.notificationSettings")}>
            <Link href="/app/settings/notifications" onClick={() => setOpen(false)}>
              <Settings className="size-3.5" />
            </Link>
          </Button>
        </div>

        <div className="max-h-[min(440px,60vh)] overflow-y-auto">
          {q.isPending ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-1.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : q.isError ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <p>{t("notif.loadError")}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : q.data.items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Bell className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium">{t("notif.empty")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("notif.emptyText")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {q.data.items.map((n) => (
                <NotificationRow key={n.id} n={n} compact onNavigate={() => setOpen(false)} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" asChild className="w-full text-xs">
            <Link href="/app/notifications" onClick={() => setOpen(false)}>
              {t("notif.viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
