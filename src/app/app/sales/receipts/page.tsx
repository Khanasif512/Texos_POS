import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { ReceiptsTable } from "@/components/sales-after/tables"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listReceipts } from "@/server/modules/sales-after/queries"
import { money } from "@/lib/format"

export const metadata: Metadata = { title: "Money receipts" }

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/sales/receipts")
  ensurePermission(ctx, "sales.view", "sales.receipt")
  const p = readListParams(await searchParams, { sortable: ["date", "number", "amount", "createdAt"], defaultSort: "date:desc" })
  const r = await listReceipts(ctx, tenantDb(ctx.companyId), p)
  return (
    <PageBody>
      <PageHeader
        title="Money receipts"
        description={`Payments against credit invoices and customer advances (SLS-04). ${r.total} receipt${r.total === 1 ? "" : "s"} · ${money(r.sumAmount)} received (excl. cancelled).`}
      />
      <ReceiptsTable rows={r.rows} total={r.total} page={p.page} limit={p.limit} />
    </PageBody>
  )
}
