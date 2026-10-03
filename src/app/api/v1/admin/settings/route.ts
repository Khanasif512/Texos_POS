import { ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { savePlatformSettings } from "@/server/modules/platform/service"
import { getBillingSettings } from "@/server/modules/platform/settings"
import { platformSettingsSchema } from "@/lib/validation/billing"

export const GET = adminRoute(async () => ok(await getBillingSettings()))

export const PUT = adminRoute(async ({ req, admin }) => {
  await savePlatformSettings(admin, await parseBody(req, platformSettingsSchema))
  return ok({}, { message: "Settings saved" })
})
