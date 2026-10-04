import Link from "next/link"
import { Compass } from "lucide-react"
import { PageBody } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { requireTenant } from "@/server/auth/context"

/** Unknown /app/* route: friendly not-found inside the app shell (every nav entry has a real page now). */
export default async function UnknownAppPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  await requireTenant(`/app/${slug.join("/")}`)
  return (
    <PageBody>
      <EmptyState
        icon={Compass}
        title="Page not found"
        text="This page doesn't exist or has moved. Use the sidebar or press Ctrl+K to search."
        action={
          <Button asChild>
            <Link href="/app">Back to dashboard</Link>
          </Button>
        }
      />
    </PageBody>
  )
}
