import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { LcForm } from "@/components/lc/lc-form"
import { LcLocked } from "@/components/lc/lc-status"
import { ensurePermission, requireTenant } from "@/server/auth/context"

export const metadata: Metadata = { title: "New LC" }

export default async function NewLcPage() {
  const ctx = await requireTenant("/app/lc/new")
  ensurePermission(ctx, "lc.create")
  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title="New LC"
        description="Record the letter of credit and what it pays for. Costs and landed cost come after the goods arrive."
        back={{ href: "/app/lc", label: "All LCs" }}
      />
      {ctx.plan.features.lc ? <LcForm /> : <LcLocked planName={ctx.plan.name} />}
    </PageBody>
  )
}
