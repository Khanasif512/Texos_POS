import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import type { Prisma } from "@/generated/prisma/client"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { prisma } from "@/server/db"
import { dateRange, readListParams, type ListSearchParams } from "@/server/list"
import { AuditTable, type AuditRow } from "./audit-table"

export const metadata: Metadata = { title: "Audit log" }

export default async function AuditPage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const ctx = await requireTenant("/app/org/audit")
  ensurePermission(ctx, "org.audit")
  const p = readListParams(await searchParams, { sortable: ["createdAt", "entityType", "action", "actorName"], defaultSort: "createdAt:desc", pageSize: 25 })
  const entity = p.get("entity")
  const action = p.get("action")
  const actor = p.get("actor")

  const base: Prisma.AuditLogWhereInput = { companyId: ctx.companyId }
  const where: Prisma.AuditLogWhereInput = {
    ...base,
    ...(entity ? { entityType: entity } : {}),
    ...(action ? { action } : {}),
    ...(actor ? (actor === "platform" ? { actorType: "admin" } : { actorId: actor }) : {}),
    ...(p.from || p.to ? { createdAt: dateRange(p.from, p.to) } : {}),
    ...(p.q ? { OR: [{ summary: { contains: p.q } }, { entityId: p.q }, { actorName: { contains: p.q } }] } : {}),
  }

  const [rows, total, entities, actions, actors] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: [p.orderBy, { id: "desc" }], skip: p.skip, take: p.take }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entityType"], where: base, orderBy: { entityType: "asc" } }),
    prisma.auditLog.groupBy({ by: ["action"], where: base, orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["actorId", "actorName"], where: { ...base, actorType: "user" }, orderBy: { actorName: "asc" } }),
  ])

  const data: AuditRow[] = rows.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    actorType: l.actorType,
    actorName: l.actorName,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    summary: l.summary,
    ip: l.ip,
    before: l.before ?? null,
    after: l.after ?? null,
  }))

  return (
    <PageBody>
      <PageHeader title="Audit log" description="Every change to financial and access-control records — who, what, before and after (AUD-01)." />
      <AuditTable
        rows={data}
        total={total}
        page={p.page}
        limit={p.limit}
        entities={entities.map((e) => e.entityType)}
        actions={actions.map((a) => a.action)}
        actors={[
          ...actors.filter((a) => a.actorId).map((a) => ({ value: a.actorId!, label: a.actorName ?? "Unknown user" })),
          { value: "platform", label: "Platform support" },
        ]}
      />
    </PageBody>
  )
}
