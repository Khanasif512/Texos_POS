import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { listNotifications } from "@/server/modules/notifications/service"

/**
 * GET /api/v1/notifications?filter=unread|all&page&limit
 * The current user's notifications (own + permitted broadcasts), newest first, with the unread count.
 */
export const GET = tenantRoute({}, async ({ req, ctx }) => {
  const sp = new URL(req.url).searchParams
  const r = await listNotifications(ctx, {
    unreadOnly: sp.get("filter") === "unread",
    page: Number(sp.get("page")) || 1,
    limit: Number(sp.get("limit")) || 20,
  })
  return ok(r, { meta: { total: r.total, page: r.page, limit: r.limit } })
})
