import { ok, parseBody } from "@/server/api"
import { audit } from "@/server/audit"
import { tenantRoute } from "@/server/route"
import { getPreferences, updateCompanySettings } from "@/server/modules/notifications/service"
import { notificationPrefsSchema } from "@/server/modules/notifications/schema"
import { resolveSettings } from "@/server/modules/notifications/rules"

/** GET /api/v1/preferences/notifications — company-wide alert preferences (any member may read). */
export const GET = tenantRoute({}, async ({ ctx }) => ok(await getPreferences(ctx.companyId)))

/** PUT — owner or settings.company. Merges into Company.settings (read-modify-write under a row lock). */
export const PUT = tenantRoute({ perm: "settings.company" }, async ({ req, ctx }) => {
  const { creditDueDays, ...prefs } = await parseBody(req, notificationPrefsSchema)
  const { after } = await updateCompanySettings(ctx.companyId, { notifications: prefs, creditDueDays }, async (tx, before, next) => {
    const b = resolveSettings(before)
    const a = resolveSettings(next)
    await audit(
      ctx,
      {
        action: "update",
        entityType: "company_settings",
        entityId: ctx.companyId,
        summary: "Updated notification preferences",
        before: { ...b.prefs, creditDueDays: b.creditDueDays },
        after: { ...a.prefs, creditDueDays: a.creditDueDays },
      },
      tx,
    )
  })
  const r = resolveSettings(after)
  return ok({ ...r.prefs, creditDueDays: r.creditDueDays }, { message: "Notification settings saved" })
})
