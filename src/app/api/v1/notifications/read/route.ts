import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { markRead } from "@/server/modules/notifications/service"
import { markReadSchema } from "@/server/modules/notifications/schema"

/** POST /api/v1/notifications/read { ids: [...] } | { all: true } — allowed in read-only workspaces too. */
export const POST = tenantRoute({ allowReadOnly: true }, async ({ req, ctx }) => {
  const updated = await markRead(ctx, await parseBody(req, markReadSchema))
  return ok({ updated })
})
