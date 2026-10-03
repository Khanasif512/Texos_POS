import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form"
import { requireAdmin } from "@/server/auth/admin-context"
import { getBillingSettings } from "@/server/modules/platform/settings"

export const metadata: Metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings")
  const settings = await getBillingSettings()
  return (
    <PageBody className="max-w-3xl">
      <PageHeader title="Platform settings" description="Trial, grace period and payment instructions for every tenant." />
      <PlatformSettingsForm initial={settings} />
    </PageBody>
  )
}
