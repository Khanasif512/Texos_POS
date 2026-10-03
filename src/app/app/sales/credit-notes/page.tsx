import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { CreditNotesTable } from "@/components/sales-after/tables"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listCreditNotes } from "@/server/modules/sales-after/queries"
import { money } from "@/lib/format"

export const metadata: Metadata = { title: "Credit notes" }

export default async function CreditNotesPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/sales/credit-notes")
  ensurePermission(ctx, "sales.view")
  const p = readListParams(await searchParams, { sortable: ["date", "number", "amount", "createdAt"], defaultSort: "date:desc" })
  const r = await listCreditNotes(ctx, tenantDb(ctx.companyId), p)
  return (
    <PageBody>
      <PageHeader
        title="Credit notes"
        description={`Customer credits from approved returns and manual adjustments. ${r.total} note${r.total === 1 ? "" : "s"} · ${money(r.sumAmount)}.`}
      />
      <CreditNotesTable rows={r.rows} total={r.total} page={p.page} limit={p.limit} />
    </PageBody>
  )
}
