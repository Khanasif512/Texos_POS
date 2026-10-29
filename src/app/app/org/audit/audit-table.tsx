"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Eye, History, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { DateRangeFilter, SelectFilter } from "@/components/shared/filters"
import { ServerTable, type ServerColumn } from "@/components/shared/server-table"
import { StatusBadge, type Tone } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { dateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { diffJson, humanize } from "./diff"

export type AuditRow = {
  id: string
  createdAt: string
  actorType: string
  actorName: string | null
  action: string
  entityType: string
  entityId: string | null
  summary: string | null
  ip: string | null
  before: unknown
  after: unknown
}

const actionTone = (a: string): Tone =>
  /delete|cancel|reject|void|revoke|deactivat/.test(a)
    ? "danger"
    : /create|approve|finali[sz]e|activat|receive/.test(a)
      ? "success"
      : /update|edit|change|override/.test(a)
        ? "info"
        : "neutral"

export function AuditPrintButton() {
  const searchParams = useSearchParams()

  return (
    <Button
      variant="outline"
      onClick={() => {
        const query = searchParams.toString()
        window.open(`/print/audit${query ? `?${query}` : ""}`, "_blank", "noopener,noreferrer")
      }}
    >
      <Printer />
      Print audit log
    </Button>
  )
}

export function AuditTable({
  rows,
  total,
  page,
  limit,
  entities,
  actions,
  actors,
}: {
  rows: AuditRow[]
  total: number
  page: number
  limit: number
  entities: string[]
  actions: string[]
  actors: { value: string; label: string }[]
}) {
  const [selected, setSelected] = useState<AuditRow | null>(null)

  const columns: ServerColumn<AuditRow>[] = [
    {
      key: "when",
      header: "When",
      sortKey: "createdAt",
      className: "w-44",
      cell: (r) => <span className="text-xs whitespace-nowrap text-muted-foreground">{dateTime(r.createdAt)}</span>,
    },
    {
      key: "action",
      header: "Action",
      sortKey: "action",
      cell: (r) => <StatusBadge tone={actionTone(r.action)}>{humanize(r.action)}</StatusBadge>,
    },
    {
      key: "entity",
      header: "Record",
      sortKey: "entityType",
      cell: (r) => <span className="text-sm whitespace-nowrap">{humanize(r.entityType)}</span>,
    },
    {
      key: "summary",
      header: "Summary",
      cell: (r) => (
        <button type="button" onClick={() => setSelected(r)} className="line-clamp-2 max-w-[460px] min-w-[200px] text-left text-sm hover:underline">
          {r.summary ?? `${humanize(r.action)} ${humanize(r.entityType).toLowerCase()}`}
        </button>
      ),
    },
    {
      key: "actor",
      header: "By",
      sortKey: "actorName",
      cell: (r) => (
        <span className="text-sm whitespace-nowrap">
          {r.actorName ?? "System"}
          {r.actorType === "admin" && <span className="ml-1 text-xs text-muted-foreground">(platform)</span>}
        </span>
      ),
    },
    {
      key: "view",
      header: <span className="sr-only">Details</span>,
      align: "right",
      cell: (r) => (
        <Button variant="ghost" size="icon-sm" onClick={() => setSelected(r)} aria-label="View changes">
          <Eye />
        </Button>
      ),
    },
  ]

  return (
    <>
      <ServerTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder="Search summary, user or record ID…"
        filters={
          <>
            <SelectFilter name="entity" placeholder="All records" options={entities.map((e) => ({ value: e, label: humanize(e) }))} />
            <SelectFilter name="action" placeholder="All actions" options={actions.map((a) => ({ value: a, label: humanize(a) }))} />
            <SelectFilter name="actor" placeholder="All users" options={actors} />
            <DateRangeFilter />
          </>
        }
        empty={
          <EmptyState
            icon={History}
            title="No activity found"
            text="Changes to LCs, invoices, expenses, credit limits, employees and roles appear here."
            className="border-0 py-8"
          />
        }
      />
      <AuditDetail row={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function AuditDetail({ row, onClose }: { row: AuditRow | null; onClose: () => void }) {
  const [showAll, setShowAll] = useState(false)
  const diff = useMemo(() => (row ? diffJson(row.before, row.after) : []), [row])
  const changed = diff.filter((d) => d.changed)
  const shown = showAll ? diff : changed
  const hasBoth = row?.before != null && row?.after != null

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {row && (
          <>
            <DialogHeader className="border-b px-5 py-4 text-left">
              <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                <StatusBadge tone={actionTone(row.action)}>{humanize(row.action)}</StatusBadge>
                <span>{humanize(row.entityType)}</span>
              </DialogTitle>
              <DialogDescription>{row.summary ?? "No summary recorded."}</DialogDescription>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                <Meta label="When" value={dateTime(row.createdAt)} />
                <Meta label="By" value={`${row.actorName ?? "System"}${row.actorType === "admin" ? " (platform)" : ""}`} />
                <Meta label="Record ID" value={row.entityId ?? "—"} mono />
                <Meta label="IP" value={row.ip ?? "—"} mono />
              </dl>
            </DialogHeader>

            <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
              <span>
                {diff.length === 0
                  ? "No before/after data was recorded for this entry."
                  : hasBoth
                    ? `${changed.length} of ${diff.length} field${diff.length === 1 ? "" : "s"} changed`
                    : row.after != null
                      ? "New record — all values shown"
                      : "Removed record — last known values shown"}
              </span>
              {hasBoth && diff.length > changed.length && (
                <label className="flex items-center gap-2">
                  <Switch size="sm" checked={showAll} onCheckedChange={setShowAll} /> Show unchanged
                </label>
              )}
            </div>

            {shown.length > 0 && (
              <div className="max-h-[55vh] overflow-auto border-t">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-5 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Before</th>
                      <th className="px-5 py-2 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shown.map((d) => (
                      <tr key={d.path} className={cn(d.changed && hasBoth && "bg-warning/[0.07]")}>
                        <td className="px-5 py-2 align-top font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                          {d.changed && hasBoth && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-warning align-middle" />}
                          {d.path}
                        </td>
                        <td className={cn("px-3 py-2 align-top break-all", d.changed && d.before !== undefined && hasBoth && "text-destructive line-through decoration-destructive/40")}>
                          {d.before === undefined ? <span className="text-muted-foreground">—</span> : d.before || <em className="text-muted-foreground">empty</em>}
                        </td>
                        <td className={cn("px-5 py-2 align-top break-all", d.changed && d.after !== undefined && "font-medium text-success")}>
                          {d.after === undefined ? <span className="text-muted-foreground">—</span> : d.after || <em className="text-muted-foreground">empty</em>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-medium text-foreground", mono && "font-mono text-[11px]")} title={value}>
        {value}
      </dd>
    </div>
  )
}
