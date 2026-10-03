import type { Metadata } from "next"
import Link from "next/link"
import { Clock } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { ReturnsTable } from "@/components/sales-after/tables"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listReturns } from "@/server/modules/sales-after/queries"

export const metadata: Metadata = { title: "Returns" }

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/sales/returns")
  ensurePermission(ctx, "sales.view", "sales.return", "sales.return_approve")
  const sp = await searchParams
  const p = readListParams(sp, { sortable: ["date", "number", "totalAmount", "createdAt"], defaultSort: "date:desc" })
  const r = await listReturns(ctx, tenantDb(ctx.companyId), p)
  return (
    <PageBody>
      <PageHeader title="Returns" description="Cash and credit invoice returns. Every return waits for a manager's approval before stock and money move (SLS-06)." />
      {r.pending > 0 && p.status !== "pending" && (
        <Link
          href="/app/sales/returns?status=pending"
          className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm hover:bg-warning/15"
        >
          <Clock className="size-4 text-warning" />
          <span>
            <span className="font-medium">{r.pending}</span> return{r.pending === 1 ? "" : "s"} waiting for approval
          </span>
          <span className="ml-auto text-xs font-medium">Review</span>
        </Link>
      )}
      <ReturnsTable rows={r.rows} total={r.total} page={p.page} limit={p.limit} />
    </PageBody>
  )
}
