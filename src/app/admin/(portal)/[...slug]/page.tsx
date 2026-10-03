import { Construction } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { requireAdmin } from "@/server/auth/admin-context"

export default async function AdminUpcomingPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  await requireAdmin()
  const title = slug[0].charAt(0).toUpperCase() + slug[0].slice(1)
  return (
    <PageBody>
      <PageHeader title={title} />
      <EmptyState icon={Construction} title="Coming in phase 7" text="Plan editing, billing runs and message inbox arrive with SaaS commercialisation." />
    </PageBody>
  )
}
