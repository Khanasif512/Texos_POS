"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DataTable } from "@/components/shared/data-table"
import { Field } from "@/components/shared/field"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { branchSchema, type BranchInput, type BranchOutput } from "@/lib/validation/org"

type Row = { id: string; code: string; name: string; address: string | null; phone: string | null; status: string; isHeadOffice: boolean; staff: number }

export function BranchesClient({ rows, canAdd }: { rows: Row[]; canAdd: boolean }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search branches…"
        toolbar={
          <Button onClick={() => (canAdd ? setEditing("new") : toast.error("Branch limit reached. Upgrade your plan to add more."))}>
            <Plus /> Add branch
          </Button>
        }
        columns={[
          {
            key: "name",
            header: "Branch",
            value: (r) => r.name,
            cell: (r) => (
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                  {r.code}
                </span>
                <div>
                  <p className="font-medium">{r.name}</p>
                  {r.isHeadOffice && <p className="text-xs text-muted-foreground">Head office</p>}
                </div>
              </div>
            ),
          },
          { key: "address", header: "Address", value: (r) => r.address, cell: (r) => <span className="text-muted-foreground">{r.address || "—"}</span> },
          { key: "phone", header: "Phone", value: (r) => r.phone, cell: (r) => r.phone || "—" },
          { key: "staff", header: "Staff", value: (r) => r.staff, align: "right", cell: (r) => <span className="num">{r.staff}</span> },
          { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <ActiveBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            align: "right",
            cell: (r) => (
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}>
                <Pencil />
              </Button>
            ),
          },
        ]}
      />
      {editing && <BranchDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function BranchDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, watch, setValue } = useForm<BranchInput, unknown, BranchOutput>({
    resolver: zodResolver(branchSchema),
    defaultValues: row
      ? { name: row.name, code: row.code, address: row.address ?? "", phone: row.phone ?? "", status: row.status as "active" }
      : { status: "active" },
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (row) await api.patch(`/api/v1/branches/${row.id}`, v)
      else await api.post("/api/v1/branches", v)
      toast.success(row ? "Branch updated" : "Branch created")
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4" /> {row ? "Edit branch" : "New branch"}
          </DialogTitle>
          <DialogDescription>Each branch keeps its own stock, invoice numbers and cash.</DialogDescription>
        </DialogHeader>
        <form id="branch-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Branch name" htmlFor="name" error={e.name?.message} required>
              <Input id="name" autoFocus {...register("name")} />
            </Field>
            <Field label="Code" htmlFor="code" error={e.code?.message} required>
              <Input id="code" className="uppercase" placeholder="DHK" {...register("code")} />
            </Field>
          </div>
          <Field label="Phone" htmlFor="phone" error={e.phone?.message}>
            <Input id="phone" {...register("phone")} />
          </Field>
          <Field label="Address" htmlFor="address" error={e.address?.message}>
            <Textarea id="address" rows={2} {...register("address")} />
          </Field>
          {row && !row.isHeadOffice && (
            <label className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive branches are hidden from sales and stock screens.</p>
              </div>
              <Switch checked={watch("status") === "active"} onCheckedChange={(c) => setValue("status", c ? "active" : "inactive")} />
            </label>
          )}
          {row?.isHeadOffice && <StatusBadge tone="info">Head office cannot be deactivated</StatusBadge>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="branch-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save changes" : "Create branch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
