"use client"

import { useRouter } from "next/navigation"
import { DataTable } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { date } from "@/lib/format"

type Row = {
  id: string
  name: string
  email: string
  status: string
  plan: string
  subStatus: string
  trialEndsAt: string | null
  users: number
  branches: number
  createdAt: string
}

const tone = (s: string) => (s === "active" ? "success" : s === "trial" || s === "trialing" ? "info" : s === "past_due" ? "warning" : "danger")

export function TenantsTable({ rows }: { rows: Row[] }) {
  const router = useRouter()
  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      searchPlaceholder="Search companies…"
      onRowClick={(r) => router.push(`/admin/tenants/${r.id}`)}
      columns={[
        {
          key: "name",
          header: "Company",
          value: (r) => `${r.name} ${r.email}`,
          cell: (r) => (
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.email}</p>
            </div>
          ),
        },
        { key: "plan", header: "Plan", value: (r) => r.plan, cell: (r) => r.plan },
        { key: "sub", header: "Subscription", value: (r) => r.subStatus, cell: (r) => <StatusBadge tone={tone(r.subStatus)}>{r.subStatus.replace("_", " ")}</StatusBadge> },
        { key: "trial", header: "Trial ends", value: (r) => r.trialEndsAt, cell: (r) => <span className="text-muted-foreground">{date(r.trialEndsAt)}</span> },
        { key: "usage", header: "Branches / users", align: "right", value: (r) => r.users, cell: (r) => <span className="num">{r.branches} / {r.users}</span> },
        { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge> },
        { key: "created", header: "Joined", value: (r) => r.createdAt, cell: (r) => <span className="text-muted-foreground">{date(r.createdAt)}</span> },
      ]}
    />
  )
}
