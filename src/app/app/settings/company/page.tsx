import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { CompanyForm } from "@/components/org/company-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"

export const metadata: Metadata = { title: "Company profile" }

export default async function CompanySettingsPage() {
  const ctx = await requireTenant("/app/settings/company")
  ensurePermission(ctx, "settings.company")
  const c = await prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } })
  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Company profile" description="These details appear on invoices, challans and money receipts." />
      <CompanyForm
        initial={{
          name: c.name,
          businessType: c.businessType ?? "",
          email: c.email,
          phone: c.phone ?? "",
          address: c.address ?? "",
          tradeLicense: c.tradeLicense ?? "",
          binNumber: c.binNumber ?? "",
          invoiceFooter: c.invoiceFooter ?? "",
          cancelWindowHours: Number((c.settings as { cancelWindowHours?: number } | null)?.cancelWindowHours ?? 24),
        }}
        workspaceId={c.slug}
      />
    </PageBody>
  )
}
