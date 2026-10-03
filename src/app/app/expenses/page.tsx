import type { Metadata } from "next"
import Link from "next/link"
import { Tags } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { ExpensesClient } from "@/components/expenses/expenses-client"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { readListParams, type ListSearchParams } from "@/server/list"
import { listExpenses } from "@/server/modules/finance/queries"

export const metadata: Metadata = { title: "Daily expenses" }

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/expenses")
  ensurePermission(ctx, "expenses.view")
  const sp = await searchParams
  const p = readListParams(sp, { sortable: ["date", "amount", "number"], defaultSort: "date:desc", pageSize: 25 })
  const db = tenantDb(ctx.companyId)
  const branchId = p.branchId && ctx.branchIds.includes(p.branchId) ? p.branchId : undefined
  const [data, categories] = await Promise.all([
    listExpenses(ctx, {
      q: p.q,
      branchId,
      categoryId: p.get("categoryId"),
      from: p.from,
      to: p.to,
      lc: p.get("lc"),
      skip: p.skip,
      take: p.take,
      orderBy: p.orderBy,
    }),
    db.expenseCategory.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], select: { id: true, name: true, status: true, lcCostType: true } }),
  ])
  return (
    <PageBody>
      <PageHeader
        title="Daily expenses"
        description="Rent, salaries, utilities and every other cost — optionally allocated to an LC's landed cost."
        actions={
          can(ctx, "expenses.update") && (
            <Button variant="outline" asChild>
              <Link href="/app/expenses/categories">
                <Tags /> Categories
              </Link>
            </Button>
          )
        }
      />
      <ExpensesClient
        rows={data.rows}
        total={data.total}
        totals={data.totals}
        page={p.page}
        limit={p.limit}
        categories={categories}
        lcEnabled={ctx.plan.features.lc}
        perms={{ create: can(ctx, "expenses.create"), update: can(ctx, "expenses.update"), remove: can(ctx, "expenses.delete") }}
      />
    </PageBody>
  )
}
