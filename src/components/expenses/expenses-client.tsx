"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Link2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { BranchFilter, DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { StatusBadge } from "@/components/shared/status-badge"
import { MethodBadge, TotalsStrip, dayDate } from "@/components/finance/shared"
import { api, errorMessage } from "@/lib/api-client"
import { date, money } from "@/lib/format"
import type { ExpenseRowView } from "@/server/modules/finance/queries"
import { ExpenseDialog, type CategoryOption } from "./expense-dialog"

export function ExpensesClient({
  rows,
  total,
  totals,
  page,
  limit,
  categories,
  lcEnabled,
  perms,
}: {
  rows: ExpenseRowView[]
  total: number
  totals: { amount: number; cash: number; allocated: number; operating: number }
  page: number
  limit: number
  categories: CategoryOption[]
  lcEnabled: boolean
  perms: { create: boolean; update: boolean; remove: boolean }
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<ExpenseRowView | "new" | null>(useSearchParams().get("new") === "1" ? "new" : null)
  const [deleting, setDeleting] = useState<ExpenseRowView | null>(null)

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/api/v1/expenses/${deleting.id}`)
      toast.success(`Expense ${deleting.number} deleted`)
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <TotalsStrip
        items={[
          { label: "Total (filtered)", value: money(totals.amount), hint: `${total} entr${total === 1 ? "y" : "ies"}` },
          { label: "Operating expenses", value: money(totals.operating), hint: "Charged to P&L" },
          { label: "Allocated to LCs", value: money(totals.allocated), hint: "Capitalised in landed cost" },
          { label: "Paid in cash", value: money(totals.cash), hint: "Counted in cash closing" },
        ]}
      />
      <ServerTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        rowKey={(r) => r.id}
        searchPlaceholder="Search number, description, reference…"
        filters={
          <>
            <BranchFilter />
            <SelectFilter name="categoryId" placeholder="All categories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            {lcEnabled && (
              <SelectFilter
                name="lc"
                placeholder="LC link: any"
                options={[
                  { value: "linked", label: "Linked to an LC" },
                  { value: "allocated", label: "Allocated to LC cost" },
                  { value: "none", label: "Not LC-linked" },
                ]}
              />
            )}
            <DateRangeFilter />
          </>
        }
        actions={
          perms.create && (
            <Button onClick={() => setEditing("new")}>
              <Plus /> Record expense
            </Button>
          )
        }
        empty="No expenses recorded for these filters."
        columns={[
          { key: "number", header: "Number", sortKey: "number", cell: (r) => <span className="num text-xs font-medium">{r.number}</span> },
          { key: "date", header: "Date", sortKey: "date", cell: (r) => <span className="whitespace-nowrap">{date(dayDate(r.date))}</span> },
          { key: "branch", header: "Branch", cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{r.branchName}</span> },
          { key: "category", header: "Category", cell: (r) => <span className="whitespace-nowrap">{r.categoryName}</span> },
          {
            key: "description",
            header: "Description",
            className: "min-w-[200px]",
            cell: (r) => (
              <div className="max-w-[320px]">
                <p className="truncate">{r.description || <span className="text-muted-foreground">—</span>}</p>
                {r.reference && <p className="truncate text-xs text-muted-foreground">Ref: {r.reference}</p>}
              </div>
            ),
          },
          { key: "method", header: "Method", cell: (r) => <MethodBadge method={r.method} /> },
          {
            key: "lc",
            header: "LC",
            cell: (r) =>
              r.lcNumber ? (
                <div className="flex flex-col gap-0.5">
                  <span className="num inline-flex items-center gap-1 text-xs">
                    <Link2 className="size-3 text-muted-foreground" /> {r.lcNumber}
                  </span>
                  {r.allocateToLc && <StatusBadge tone="info" className="w-fit">In landed cost</StatusBadge>}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          { key: "amount", header: "Amount", sortKey: "amount", align: "right", cell: (r) => <span className="num font-medium">{money(r.amount)}</span> },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (r) => (
              <div className="flex justify-end gap-1">
                {perms.update && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.number}`}>
                    <Pencil />
                  </Button>
                )}
                {perms.remove && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(r)}
                    aria-label={`Delete ${r.number}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <ExpenseDialog row={editing === "new" ? null : editing} categories={categories} lcEnabled={lcEnabled} onClose={() => setEditing(null)} />
      )}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense {deleting?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {money(deleting?.amount ?? 0)} · {deleting?.categoryName}.{" "}
              {deleting?.allocateToLc
                ? `Its cost item on LC ${deleting.lcNumber} is removed too — recalculate that LC's landed cost afterwards.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
