"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck, Loader2, RefreshCw, Settings } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { useI18n } from "@/components/i18n/i18n-provider"
import { api, errorMessage } from "@/lib/api-client"
import { NOTIFICATIONS_KEY, NotificationRow, useMarkRead, type NotificationsPage } from "./notifications-shared"

/** /app/notifications — full list with Unread / All filter (?filter=unread), paged with "Load more". */
export function NotificationsCenter({ canRunChecks }: { canRunChecks: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const filter = sp.get("filter") === "unread" ? "unread" : "all"
  const qc = useQueryClient()
  const markRead = useMarkRead()

  const q = useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, "page", filter],
    queryFn: ({ pageParam }) => api.get<NotificationsPage>(`/api/v1/notifications?filter=${filter}&limit=20&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    refetchInterval: 60_000,
  })
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const unread = q.data?.pages[0]?.unread ?? 0

  const run = useMutation({
    mutationFn: () => api.post<{ created: number }>("/api/v1/notifications/run-jobs"),
    onSuccess: (r) => {
      toast.success(t("notif.runDone", { count: r.created }))
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const setFilter = (v: string) => {
    const next = new URLSearchParams(sp.toString())
    if (v === "unread") next.set("filter", "unread")
    else next.delete("filter")
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  return (
    <>
      <PageHeader
        title={t("notif.title")}
        description={t("notif.description")}
        actions={
          <>
            {canRunChecks && (
              <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
                {run.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {t("notif.runNow")}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/settings/notifications">
                <Settings /> {t("notif.settings")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">{t("notif.filter.all")}</TabsTrigger>
              <TabsTrigger value="unread">
                {t("notif.filter.unread")}
                {unread > 0 && <span className="num ml-1.5 rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">{unread}</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={unread === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true }, { onSuccess: () => toast.success(t("notif.markedAll")) })}
          >
            {markRead.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
            {t("notif.markAllRead")}
          </Button>
        </div>

        {q.isPending ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3.5">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            <p>{t("notif.loadError")}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === "unread" ? t("notif.emptyUnread") : t("notif.empty")}
            text={t("notif.emptyText")}
            className="m-4 border-0"
          />
        ) : (
          <>
            <div className="divide-y">
              {items.map((n) => (
                <NotificationRow key={n.id} n={n} />
              ))}
            </div>
            {q.hasNextPage && (
              <div className="border-t p-2 text-center">
                <Button variant="ghost" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                  {q.isFetchingNextPage && <Loader2 className="animate-spin" />}
                  {t("common.loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
