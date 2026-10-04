import type { Metadata } from "next"
import { PageBody } from "@/components/app/page-header"
import { NotificationsCenter } from "@/components/app/notifications-center"
import { requireTenant } from "@/server/auth/context"

export const metadata: Metadata = { title: "Notifications" }

export default async function NotificationsPage() {
  const ctx = await requireTenant("/app/notifications")
  return (
    <PageBody className="max-w-4xl">
      <NotificationsCenter canRunChecks={ctx.isOwner} />
    </PageBody>
  )
}
