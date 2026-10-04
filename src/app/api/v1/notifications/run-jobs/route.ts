import { ok } from "@/server/api"
import { forbidden } from "@/server/errors"
import { rateLimit } from "@/server/rate-limit"
import { tenantRoute } from "@/server/route"
import { runNotificationJobs } from "@/server/modules/notifications/jobs"

/** POST /api/v1/notifications/run-jobs — owner-only manual run of the AUD-02 checks for their own company. */
export const POST = tenantRoute({ allowReadOnly: true }, async ({ ctx }) => {
  if (!ctx.isOwner) throw forbidden("Only the workspace owner can run notification checks")
  rateLimit(`notif-jobs:${ctx.companyId}`, 6, 60_000)
  const r = await runNotificationJobs(new Date(), { companyId: ctx.companyId })
  return ok({ created: r.created, emails: r.emails }, { message: `${r.created} new notification(s)` })
})
