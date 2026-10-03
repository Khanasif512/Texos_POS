"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { SelectFilter } from "@/components/shared/filters"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { useCan } from "@/components/app/app-context"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { SupplierDialog } from "./supplier-dialog"

export type SupplierRow = {
  id: string
  code: string
  name: string
  country: string | null
  currency: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  totalPurchases: number
  balance: number
  status: string
}

export function SuppliersTable({ rows, total, page, limit, filtered }: { rows: SupplierRow[]; total: number; page: number; limit: number; filtered: boolean }) {
  const router = useRouter()
  const canCreate = useCan("suppliers.create")
  const [adding, setAdding] = useState(false)
  return (
    <>
      <ServerTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        rowKey={(r) => r.id}
        onRowHref={(r) => `/app/suppliers/${r.id}`}
        searchPlaceholder="Search name, code or country…"
        filters={
          <>
            <SelectFilter
              name="currency"
              placeholder="All currencies"
              options={[
                { value: "RMB", label: "RMB" },
                { value: "USD", label: "USD" },
                { value: "BDT", label: "BDT" },
              ]}
            />
            <SelectFilter
              name="status"
              placeholder="All statuses"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </>
        }
        actions={
          canCreate && (
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add supplier
            </Button>
          )
        }
        empty={
          filtered ? (
            "No suppliers match these filters."
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <Truck className="size-5" />
              </span>
              <p>No suppliers yet. Add the factories and traders you import from.</p>
              {canCreate && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus /> Add your first supplier
                </Button>
              )}
            </div>
          )
        }
        columns={[
          { key: "code", header: "Code", sortKey: "code", cell: (r) => <span className="num text-xs text-muted-foreground">{r.code}</span> },
          {
            key: "name",
            header: "Supplier",
            sortKey: "name",
            cell: (r) => (
              <div className="min-w-[180px]">
                <Link href={`/app/suppliers/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                {r.country && <p className="text-xs text-muted-foreground">{r.country}</p>}
              </div>
            ),
          },
          { key: "currency", header: "Currency", cell: (r) => <StatusBadge tone="primary">{r.currency}</StatusBadge> },
          {
            key: "contact",
            header: "Contact",
            cell: (r) =>
              r.contactPerson || r.phone ? (
                <div className="text-sm">
                  <p>{r.contactPerson ?? "—"}</p>
                  {r.phone && <p className="text-xs text-muted-foreground">{r.phone}</p>}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "purchases",
            header: "Total purchases",
            align: "right",
            cell: (r) => <span className={cn("num", !r.totalPurchases && "text-muted-foreground")}>{money(r.totalPurchases)}</span>,
          },
          {
            key: "balance",
            header: "Payable",
            sortKey: "balance",
            align: "right",
            cell: (r) => (
              <span className={cn("num font-medium", r.balance > 0 ? "text-destructive" : r.balance < 0 ? "text-success" : "text-muted-foreground")}>
                {money(r.balance)}
              </span>
            ),
          },
          { key: "status", header: "Status", cell: (r) => <ActiveBadge status={r.status} /> },
        ]}
      />
      {adding && <SupplierDialog row={null} onClose={() => setAdding(false)} onSaved={(id) => router.push(`/app/suppliers/${id}`)} />}
    </>
  )
}
