import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { ProfileForms } from "@/components/org/profile-forms"
import { requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"

export const metadata: Metadata = { title: "My profile" }

export default async function ProfilePage() {
  const ctx = await requireTenant("/app/profile")
  const u = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } })
  return (
    <PageBody className="max-w-3xl">
      <PageHeader title="My profile" description={`${ctx.roleName} · ${ctx.company.name}`} />
      <ProfileForms name={u.name} phone={u.phone ?? ""} email={u.email} />
    </PageBody>
  )
}
