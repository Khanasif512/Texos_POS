/** Hourly background jobs (single-instance deployments). Multi-instance: call POST /api/v1/admin/jobs/run from a cron instead. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_JOBS === "1") return
  const { runSubscriptionJobs } = await import("@/server/modules/platform/jobs")
  const { runNotificationJobs } = await import("@/server/modules/notifications/jobs")
  const run = async () => {
    try {
      await runSubscriptionJobs()
      await runNotificationJobs()
    } catch (e) {
      console.error("[jobs] failed", e)
    }
  }
  setTimeout(run, 60_000)
  setInterval(run, 60 * 60_000)
}
