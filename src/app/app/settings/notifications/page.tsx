import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { NotificationsSettingsForm } from "@/components/app/notifications-settings-form"
import { can, requireTenant } from "@/server/auth/context"
import { getT } from "@/lib/i18n/server"
import { getPreferences } from "@/server/modules/notifications/service"

export const metadata: Metadata = { title: "Notification settings" }

export default async function NotificationSettingsPage() {
  const ctx = await requireTenant("/app/settings/notifications")
  const [prefs, t] = await Promise.all([getPreferences(ctx.companyId), getT()])
  return (
    <PageBody className="max-w-3xl">
      <PageHeader title={t("notifSettings.title")} description={t("notifSettings.description")} />
      <NotificationsSettingsForm initial={prefs} canEdit={can(ctx, "settings.company") && !ctx.readOnly} />
    </PageBody>
  )
}
