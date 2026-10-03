import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { ReturnForm } from "@/components/sales-after/return-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { returnableInvoice } from "@/server/modules/sales-after/returns"

export const metadata: Metadata = { title: "New return" }

export default async function NewReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireTenant("/app/sales/returns/new")
  ensurePermission(ctx, "sales.return")
  const { invoiceId } = await searchParams
  const initial = invoiceId ? await returnableInvoice(ctx, tenantDb(ctx.companyId), invoiceId).catch(() => null) : null
  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/sales/returns", label: "Returns" }}
        title="New return"
        description="Choose the invoice and the items coming back. The request goes to a manager for approval."
      />
      {initial && !initial.returnable && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          Invoice {initial.number} is {initial.status.replace("_", " ")} and cannot take a return. Pick another invoice.
        </p>
      )}
      <ReturnForm initial={initial?.returnable ? initial : null} />
    </PageBody>
  )
}
