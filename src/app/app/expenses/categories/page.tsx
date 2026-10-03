import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { CategoriesClient } from "@/components/expenses/categories-client"
import { can, ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { num } from "@/server/decimal"

export const metadata: Metadata = { title: "Expense categories" }

export default async function ExpenseCategoriesPage() {
  const ctx = await requireTenant("/app/expenses/categories")
  ensurePermission(ctx, "expenses.update", "expenses.view")
  const db = tenantDb(ctx.companyId)
  const [cats, sums] = await Promise.all([
    db.expenseCategory.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], include: { _count: { select: { expenses: true } } } }),
    db.expense.groupBy({ by: ["categoryId"], _sum: { amount: true } }),
  ])
  const sum = new Map(sums.map((s) => [s.categoryId, num(s._sum.amount)]))
  return (
    <PageBody>
      <PageHeader
        title="Expense categories"
        description="Default categories match your cost sheet. Map a category to an LC cost type so expenses allocated to an LC land in the right cost bucket."
        back={{ href: "/app/expenses", label: "Daily expenses" }}
      />
      <CategoriesClient
        canEdit={can(ctx, "expenses.update")}
        canDelete={can(ctx, "expenses.delete") || can(ctx, "expenses.update")}
        rows={cats.map((c) => ({
          id: c.id,
          name: c.name,
          isSystem: c.isSystem,
          lcCostType: c.lcCostType,
          status: c.status,
          expenseCount: c._count.expenses,
          total: sum.get(c.id) ?? 0,
        }))}
      />
    </PageBody>
  )
}
