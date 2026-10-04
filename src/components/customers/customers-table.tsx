"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ServerTable } from "@/components/shared/server-table"
import { SelectFilter } from "@/components/shared/filters"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { useCan } from "@/components/app/app-context"
import { money } from "@/lib/format"
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPES, type CustomerType } from "@/lib/validation/customers"
import { CustomerBalance } from "./balance"
import { CustomerDialog } from "./customer-dialog"

export type CustomerRow = {
  id: string
  code: string
  name: string
  phone: string | null
  address: string | null
  type: string
  creditLimit: number
  balance: number
  status: string
}

const TYPE_TONE = { retail: "neutral", wholesale: "info", dealer: "primary" } as const

export function CustomersTable({ rows, total, page, limit, filtered }: { rows: CustomerRow[]; total: number; page: number; limit: number; filtered: boolean }) {
  const router = useRouter()
  const canCreate = useCan("customers.create")
  const [adding, setAdding] = useState(useSearchParams().get("new") === "1")
  return (
    <>
      <ServerTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        rowKey={(r) => r.id}
        onRowHref={(r) => `/app/customers/${r.id}`}
        searchPlaceholder="Search name, phone or code…"
        filters={
          <>
            <SelectFilter name="type" placeholder="All types" options={CUSTOMER_TYPES.map((t) => ({ value: t, label: CUSTOMER_TYPE_LABELS[t] }))} />
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
              <UserPlus /> Add customer
            </Button>
          )
        }
        empty={
          filtered ? (
            "No customers match these filters."
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <Users className="size-5" />
              </span>
              <p>No customers yet. Add retail buyers, wholesalers and dealers to sell on credit.</p>
              {canCreate && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <UserPlus /> Add your first customer
                </Button>
              )}
            </div>
          )
        }
        columns={[
          { key: "code", header: "Code", sortKey: "code", cell: (r) => <span className="num text-xs text-muted-foreground">{r.code}</span> },
          {
            key: "name",
            header: "Customer",
            sortKey: "name",
            cell: (r) => (
              <div className="min-w-[160px]">
                <Link href={`/app/customers/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                {r.address && <p className="line-clamp-1 max-w-[260px] text-xs text-muted-foreground">{r.address}</p>}
              </div>
            ),
          },
          { key: "phone", header: "Phone", cell: (r) => <span className="num whitespace-nowrap">{r.phone ?? "—"}</span> },
          {
            key: "type",
            header: "Type",
            cell: (r) => <StatusBadge tone={TYPE_TONE[r.type as CustomerType] ?? "neutral"}>{CUSTOMER_TYPE_LABELS[r.type as CustomerType] ?? r.type}</StatusBadge>,
          },
          {
            key: "limit",
            header: "Credit limit",
            sortKey: "creditLimit",
            align: "right",
            cell: (r) => <span className={r.creditLimit ? "num" : "text-xs text-muted-foreground"}>{r.creditLimit ? money(r.creditLimit) : "Cash only"}</span>,
          },
          { key: "balance", header: "Outstanding", sortKey: "balance", align: "right", cell: (r) => <CustomerBalance value={r.balance} /> },
          { key: "status", header: "Status", cell: (r) => <ActiveBadge status={r.status} /> },
        ]}
      />
      {adding && <CustomerDialog row={null} onClose={() => setAdding(false)} onSaved={(id) => router.push(`/app/customers/${id}`)} />}
    </>
  )
}
