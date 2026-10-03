import { timingSafeEqual } from "node:crypto"
import { handle, ok } from "@/server/api"
import { adminFromRequest } from "@/server/auth/admin-context"
import { audit } from "@/server/audit"
import { runSubscriptionJobs } from "@/server/modules/platform/jobs"

function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get("x-cron-secret")
  if (!secret || !given) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Runs the subscription lifecycle job now. Auth: platform admin session, or header x-cron-secret = CRON_SECRET. */
export const POST = handle(async (req: Request) => {
  const admin = cronAuthorized(req) ? null : await adminFromRequest()
  const report = await runSubscriptionJobs()
  if (admin) await audit({ admin }, { action: "run_jobs", entityType: "platform", summary: "Ran subscription jobs manually", after: report })
  return ok(report, { message: "Subscription jobs completed" })
})
