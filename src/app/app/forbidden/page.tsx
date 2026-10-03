import Link from "next/link"
import { ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageBody } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function ForbiddenPage() {
  return (
    <PageBody>
      <EmptyState
        icon={ShieldX}
        title="You don't have access to this page"
        text="Your role does not include permission for this area. Ask your company owner if you need access."
        action={
          <Button asChild variant="outline">
            <Link href="/app">Back to dashboard</Link>
          </Button>
        }
      />
    </PageBody>
  )
}
