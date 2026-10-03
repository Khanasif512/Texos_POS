import type { Metadata } from "next"
import { History } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { dateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Audit log" }

const TONE = { create: "success", update: "info", delete: "danger" } as const

export default async function AuditPage() {
  const ctx = await requireTenant("/app/org/audit")
  ensurePermission(ctx, "org.audit")
  const logs = await prisma.auditLog.findMany({ where: { companyId: ctx.companyId }, orderBy: { createdAt: "desc" }, take: 200 })
  return (
    <PageBody>
      <PageHeader title="Audit log" description="The latest 200 changes to sensitive records in your workspace." />
      {logs.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" text="Changes to branches, employees, roles, LCs, invoices and expenses will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">{dateTime(l.createdAt)}</span>
                <StatusBadge tone={TONE[l.action as keyof typeof TONE] ?? "neutral"} className="w-fit capitalize">
                  {l.action}
                </StatusBadge>
                <span className="flex-1 text-sm">{l.summary ?? `${l.action} ${l.entityType}`}</span>
                <span className="text-xs text-muted-foreground">
                  {l.actorName}
                  {l.actorType === "admin" && " (platform)"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageBody>
  )
}
