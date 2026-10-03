"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Crown, Loader2, Pencil, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DataTable } from "@/components/shared/data-table"
import { Field } from "@/components/shared/field"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { PasswordInput } from "@/components/auth/password-input"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { dateTime, initials } from "@/lib/format"
import { employeeSchema, type EmployeeInput, type EmployeeOutput } from "@/lib/validation/org"

type Row = {
  id: string
  name: string
  email: string
  phone: string | null
  roleId: string
  roleName: string
  isOwner: boolean
  allBranches: boolean
  branchIds: string[]
  employeeCode: string | null
  designation: string | null
  joiningDate: string | null
  salary: number | null
  status: string
  lastLoginAt: string | null
}
type Opt = { id: string; name: string }

export function EmployeesClient({
  rows,
  roles,
  branches,
  canAdd,
  currentUserId,
}: {
  rows: Row[]
  roles: Opt[]
  branches: (Opt & { code: string })[]
  canAdd: boolean
  currentUserId: string
}) {
  const [editing, setEditing] = useState<Row | "new" | null>(null)
  const branchName = new Map(branches.map((b) => [b.id, b.code]))
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by name, email, role…"
        toolbar={
          <Button onClick={() => (canAdd ? setEditing("new") : toast.error("Team member limit reached. Upgrade your plan."))}>
            <UserPlus /> Add employee
          </Button>
        }
        columns={[
          {
            key: "name",
            header: "Employee",
            value: (r) => `${r.name} ${r.email}`,
            cell: (r) => (
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(r.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    {r.name}
                    {r.isOwner && <Crown className="size-3.5 text-warning" />}
                    {r.id === currentUserId && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                </div>
              </div>
            ),
          },
          { key: "code", header: "ID", value: (r) => r.employeeCode, cell: (r) => <span className="num text-muted-foreground">{r.employeeCode ?? "—"}</span> },
          {
            key: "role",
            header: "Role",
            value: (r) => r.roleName,
            cell: (r) => (
              <div>
                <p>{r.roleName}</p>
                {r.designation && <p className="text-xs text-muted-foreground">{r.designation}</p>}
              </div>
            ),
          },
          {
            key: "branches",
            header: "Branches",
            cell: (r) =>
              r.allBranches || r.isOwner ? (
                <StatusBadge tone="primary">All branches</StatusBadge>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {r.branchIds.map((id) => (
                    <StatusBadge key={id}>{branchName.get(id) ?? "?"}</StatusBadge>
                  ))}
                </div>
              ),
          },
          {
            key: "login",
            header: "Last sign-in",
            value: (r) => r.lastLoginAt,
            cell: (r) => <span className="text-xs text-muted-foreground">{r.lastLoginAt ? dateTime(r.lastLoginAt) : "Never"}</span>,
          },
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
      {editing && (
        <EmployeeDialog
          row={editing === "new" ? null : editing}
          roles={roles}
          branches={branches}
          isSelf={editing !== "new" && editing.id === currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function EmployeeDialog({
  row,
  roles,
  branches,
  isSelf,
  onClose,
}: {
  row: Row | null
  roles: Opt[]
  branches: (Opt & { code: string })[]
  isSelf: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, control, watch } = useForm<EmployeeInput, unknown, EmployeeOutput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: row
      ? {
          name: row.name,
          email: row.email,
          phone: row.phone ?? "",
          roleId: row.roleId,
          branchIds: row.branchIds,
          allBranches: row.allBranches,
          employeeCode: row.employeeCode ?? "",
          designation: row.designation ?? "",
          joiningDate: row.joiningDate ?? "",
          salary: row.salary,
          status: row.status as "active",
          password: "",
        }
      : { branchIds: branches.slice(0, 1).map((b) => b.id), allBranches: false, status: "active", roleId: "" },
  })
  const e = formState.errors
  const allBranches = watch("allBranches")
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (row) await api.patch(`/api/v1/employees/${row.id}`, v)
      else await api.post("/api/v1/employees", v)
      toast.success(row ? "Employee updated" : "Employee added")
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.name}` : "Add employee"}</DialogTitle>
          <DialogDescription>Employees sign in with their email and only see the branches you assign.</DialogDescription>
        </DialogHeader>
        <form id="employee-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Full name" htmlFor="name" error={e.name?.message} required>
            <Input id="name" autoFocus {...register("name")} />
          </Field>
          <Field label="Email (login)" htmlFor="email" error={e.email?.message} required>
            <Input id="email" type="email" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={e.phone?.message}>
            <Input id="phone" {...register("phone")} />
          </Field>
          <Field label="Role" error={e.roleId?.message} required>
            {row?.isOwner ? (
              <Input value="Company Owner" disabled />
            ) : (
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field label="Employee ID" htmlFor="employeeCode" error={e.employeeCode?.message} hint={row ? undefined : "Leave blank to auto-generate"}>
            <Input id="employeeCode" {...register("employeeCode")} />
          </Field>
          <Field label="Designation" htmlFor="designation" error={e.designation?.message}>
            <Input id="designation" placeholder="e.g. Senior Salesman" {...register("designation")} />
          </Field>
          <Field label="Joining date" htmlFor="joiningDate" error={e.joiningDate?.message}>
            <Input id="joiningDate" type="date" {...register("joiningDate")} />
          </Field>
          <Field label="Monthly salary (৳)" htmlFor="salary" error={e.salary?.message}>
            <Input id="salary" type="number" step="0.01" min="0" {...register("salary")} />
          </Field>

          {!row?.isOwner && (
            <div className="grid gap-3 rounded-lg border p-3 sm:col-span-2">
              <Controller
                control={control}
                name="allBranches"
                render={({ field }) => (
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Access to all branches</p>
                      <p className="text-xs text-muted-foreground">Including branches added in the future.</p>
                    </div>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
              {!allBranches && (
                <Controller
                  control={control}
                  name="branchIds"
                  render={({ field }) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {branches.map((b) => {
                        const checked = field.value?.includes(b.id)
                        return (
                          <label key={b.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) =>
                                field.onChange(c ? [...(field.value ?? []), b.id] : (field.value ?? []).filter((x) => x !== b.id))
                              }
                            />
                            {b.name}
                          </label>
                        )
                      })}
                    </div>
                  )}
                />
              )}
              {e.branchIds?.message && <p className="text-xs font-medium text-destructive">{e.branchIds.message}</p>}
            </div>
          )}

          <Field
            label={row ? "Set new password" : "Initial password"}
            htmlFor="password"
            error={e.password?.message}
            hint={row ? "Leave blank to keep the current password." : "Share it with the employee securely."}
            required={!row}
            className="sm:col-span-2"
          >
            <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
          </Field>

          {row && !row.isOwner && !isSelf && (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <label className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">Account active</p>
                    <p className="text-xs text-muted-foreground">Deactivating signs the employee out immediately. Their history is kept.</p>
                  </div>
                  <Switch checked={field.value === "active"} onCheckedChange={(c) => field.onChange(c ? "active" : "inactive")} />
                </label>
              )}
            />
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {row ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
