import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { MessagesClient } from "@/components/admin/messages-client"
import { requireAdmin } from "@/server/auth/admin-context"
import { prisma } from "@/server/db"

export const metadata: Metadata = { title: "Contact messages" }

export default async function AdminMessagesPage() {
  await requireAdmin("/admin/messages")
  const messages = await prisma.contactMessage.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 500 })
  const open = messages.filter((m) => !m.handled).length
  return (
    <PageBody className="max-w-5xl">
      <PageHeader title="Contact messages" description={`${open} open · ${messages.length - open} handled. Sent from the public contact form.`} />
      <MessagesClient rows={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))} />
    </PageBody>
  )
}
