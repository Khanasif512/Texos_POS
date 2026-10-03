import Link from "next/link"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"

/** Shown instead of a module page when the plan does not include the feature (TEN-03; the API enforces it too). */
export function FeatureLocked({ title, feature, planName }: { title: string; feature: string; planName: string }) {
  return (
    <PageBody>
      <PageHeader title={title} />
      <EmptyState
        icon={Lock}
        title={`${feature} is not in the ${planName} plan`}
        text="Upgrade your subscription to unlock this module. Your existing data is kept."
        action={
          <Button asChild>
            <Link href="/app/settings/billing">See plans</Link>
          </Button>
        }
      />
    </PageBody>
  )
}
