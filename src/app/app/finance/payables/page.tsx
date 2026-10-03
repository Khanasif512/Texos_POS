import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { PayablesClient } from "@/components/finance/payables-client"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { num, sum } from "@/server/decimal"
import { readListParams, type ListSearchParams } from "@/server/list"
import { payablesOverview } from "@/server/modules/finance/payments"
import { listSupplierPayments } from "@/server/modules/finance/queries"

export const metadata: Metadata = { title: "Supplier payables" }

export default async function PayablesPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/finance/payables")
  ensurePermission(ctx, "finance.view", "finance.supplier_payment")
  const sp = await searchParams
  const p = readListParams(sp, { sortable: ["date", "amount", "number"], defaultSort: "date:desc", pageSize: 15 })
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const [overview, payments] = await Promise.all([
    payablesOverview(tenantDb(ctx.companyId)),
    listSupplierPayments(ctx, {
      q: p.q,
      branchId,
      supplierId: p.get("supplierId"),
      method: p.get("method"),
      from: p.from,
      to: p.to,
      skip: p.skip,
      take: p.take,
      orderBy: p.orderBy,
    }),
  ])
  const outstanding = num(sum(overview.filter((r) => r.outstanding > 0).map((r) => String(r.outstanding))))
  const advances = num(sum(overview.filter((r) => r.outstanding < 0).map((r) => String(-r.outstanding))))
  return (
    <PageBody>
      <PageHeader
        title="Supplier payables"
        description="What you owe each supplier: purchases and finalized LC values minus recorded payments (the LC payment itself happens at the bank)."
      />
      <PayablesClient
        overview={overview}
        outstanding={outstanding}
        advances={advances}
        payments={payments.rows}
        paymentsTotal={payments.total}
        paymentsSum={payments.sum}
        page={p.page}
        limit={p.limit}
        canPay={can(ctx, "finance.supplier_payment")}
        lcEnabled={ctx.plan.features.lc}
      />
    </PageBody>
  )
}
