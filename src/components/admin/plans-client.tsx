"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Package, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { DataTable } from "@/components/shared/data-table"
import { Field } from "@/components/shared/field"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { integer, money } from "@/lib/format"
import { FEATURE_LABELS, type PlanFeatures } from "@/lib/permissions"
import { planSchema, type PlanInput, type PlanOutput } from "@/lib/validation/billing"

type Row = {
  id: string
  code: string
  name: string
  tagline: string | null
  priceMonthly: number
  priceYearly: number
  maxBranches: number
  maxEmployees: number
  maxProducts: number | null
  features: Record<string, boolean>
  isPublic: boolean
  isDefaultTrial: boolean
  sortOrder: number
  status: string
  tenants: number
}

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as (keyof PlanFeatures)[]

export function PlansClient({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search plans…"
        onRowClick={(r) => setEditing(r)}
        toolbar={
          <Button onClick={() => setEditing("new")}>
            <Plus /> New plan
          </Button>
        }
        columns={[
          {
            key: "name",
            header: "Plan",
            value: (r) => `${r.name} ${r.code}`,
            cell: (r) => (
              <div>
                <p className="flex items-center gap-2 font-medium">
                  {r.name}
                  {r.isDefaultTrial && <StatusBadge tone="info">Trial plan</StatusBadge>}
                  {!r.isPublic && <StatusBadge>Hidden</StatusBadge>}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{r.code}</p>
              </div>
            ),
          },
          {
            key: "price",
            header: "Monthly / yearly",
            align: "right",
            value: (r) => r.priceMonthly,
            cell: (r) => (
              <div className="num">
                <p>{money(r.priceMonthly)}</p>
                <p className="text-xs text-muted-foreground">{money(r.priceYearly)}</p>
              </div>
            ),
          },
          {
            key: "limits",
            header: "Branches · users · products",
            cell: (r) => (
              <span className="num whitespace-nowrap">
                {r.maxBranches} · {integer(r.maxEmployees)} · {r.maxProducts == null ? "∞" : integer(r.maxProducts)}
              </span>
            ),
          },
          {
            key: "features",
            header: "Features",
            cell: (r) => (
              <span className="text-xs text-muted-foreground">
                {FEATURE_KEYS.filter((k) => r.features[k]).length} of {FEATURE_KEYS.length}
              </span>
            ),
          },
          { key: "tenants", header: "Tenants", align: "right", value: (r) => r.tenants, cell: (r) => <span className="num">{r.tenants}</span> },
          { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <ActiveBadge status={r.status} /> },
          {
            key: "edit",
            header: "",
            align: "right",
            cell: (r) => (
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`} onClick={(e) => (e.stopPropagation(), setEditing(r))}>
                <Pencil />
              </Button>
            ),
          },
        ]}
      />
      {editing && <PlanDialog row={editing === "new" ? null : editing} nextSort={Math.max(0, ...rows.map((r) => r.sortOrder)) + 1} onClose={() => setEditing(null)} />}
    </>
  )
}

function PlanDialog({ row, nextSort, onClose }: { row: Row | null; nextSort: number; onClose: () => void }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, watch, setValue } = useForm<PlanInput, unknown, PlanOutput>({
    resolver: zodResolver(planSchema),
    defaultValues: row
      ? {
          code: row.code,
          name: row.name,
          tagline: row.tagline ?? "",
          priceMonthly: row.priceMonthly,
          priceYearly: row.priceYearly,
          maxBranches: row.maxBranches,
          maxEmployees: row.maxEmployees,
          maxProducts: row.maxProducts ?? "",
          features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, !!row.features[k]])),
          isPublic: row.isPublic,
          isDefaultTrial: row.isDefaultTrial,
          sortOrder: row.sortOrder,
          status: row.status as "active",
        }
      : {
          features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])),
          isPublic: true,
          isDefaultTrial: false,
          sortOrder: nextSort,
          status: "active",
          maxProducts: "",
        },
  })
  const e = formState.errors
  const features = (watch("features") ?? {}) as Record<string, boolean>
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (row) await api.patch(`/api/v1/admin/plans/${row.id}`, v)
      else await api.post("/api/v1/admin/plans", v)
      toast.success(row ? (row.tenants ? `Plan saved — applies to ${row.tenants} tenant${row.tenants > 1 ? "s" : ""} now` : "Plan saved") : "Plan created")
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  const toggle = (name: "isPublic" | "isDefaultTrial", label: string, hint: string) => (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {e[name]?.message && <p className="text-xs font-medium text-destructive">{e[name]?.message}</p>}
      </div>
      <Switch checked={!!watch(name)} onCheckedChange={(c) => setValue(name, c, { shouldDirty: true })} />
    </label>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4" /> {row ? `Edit ${row.name}` : "New plan"}
          </DialogTitle>
          <DialogDescription>
            {row?.tenants ? `${row.tenants} tenant${row.tenants > 1 ? "s are" : " is"} on this plan — changes apply to them immediately.` : "Prices in BDT."}
          </DialogDescription>
        </DialogHeader>
        <form id="plan-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Name" htmlFor="name" error={e.name?.message} required>
              <Input id="name" autoFocus {...register("name")} />
            </Field>
            <Field label="Code" htmlFor="code" error={e.code?.message} required>
              <Input id="code" className="font-mono lowercase" placeholder="growth" {...register("code")} />
            </Field>
          </div>
          <Field label="Tagline" htmlFor="tagline" error={e.tagline?.message}>
            <Input id="tagline" {...register("tagline")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly price" htmlFor="priceMonthly" error={e.priceMonthly?.message} required>
              <Input id="priceMonthly" type="number" step="0.01" min={0} className="num" {...register("priceMonthly")} />
            </Field>
            <Field label="Yearly price" htmlFor="priceYearly" error={e.priceYearly?.message} required>
              <Input id="priceYearly" type="number" step="0.01" min={0} className="num" {...register("priceYearly")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Max branches" htmlFor="maxBranches" error={e.maxBranches?.message} required>
              <Input id="maxBranches" type="number" min={1} className="num" {...register("maxBranches")} />
            </Field>
            <Field label="Max users" htmlFor="maxEmployees" error={e.maxEmployees?.message} required>
              <Input id="maxEmployees" type="number" min={1} className="num" {...register("maxEmployees")} />
            </Field>
            <Field label="Max products" htmlFor="maxProducts" error={e.maxProducts?.message} hint="Empty = unlimited">
              <Input id="maxProducts" type="number" min={1} className="num" {...register("maxProducts")} />
            </Field>
            <Field label="Sort order" htmlFor="sortOrder" error={e.sortOrder?.message}>
              <Input id="sortOrder" type="number" min={0} className="num" {...register("sortOrder")} />
            </Field>
          </div>
          <fieldset className="rounded-lg border p-3">
            <legend className="px-1 text-[13px] font-medium">Features</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURE_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!features[k]} onCheckedChange={(c) => setValue(`features.${k}`, c === true, { shouldDirty: true })} />
                  {FEATURE_LABELS[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {toggle("isPublic", "Public", "Shown on /pricing and the in-app plan picker")}
            {toggle("isDefaultTrial", "Default trial plan", "New companies start their trial on it (only one)")}
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive plans cannot be chosen; existing tenants keep them.</p>
            </div>
            <Switch checked={watch("status") === "active"} onCheckedChange={(c) => setValue("status", c ? "active" : "inactive")} />
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save plan" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
