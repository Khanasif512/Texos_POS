"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, Plus, ShieldCheck, Trash2, Users } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { StatusBadge } from "@/components/shared/status-badge"
import { api, errorMessage } from "@/lib/api-client"
import { PERMISSION_MODULES } from "@/lib/permissions"
import { cn } from "@/lib/utils"

type Role = { id: string; key: string | null; name: string; description: string | null; isSystem: boolean; users: number; permissions: string[] }
type Draft = { id: string | null; name: string; description: string; permissions: Set<string> }

const toDraft = (r: Role): Draft => ({ id: r.id, name: r.name, description: r.description ?? "", permissions: new Set(r.permissions) })

export function RolesClient({ roles }: { roles: Role[] }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(roles[1]?.id ?? roles[0]?.id ?? null)
  const selected = roles.find((r) => r.id === selectedId) ?? null
  const [draft, setDraft] = useState<Draft | null>(selected ? toDraft(selected) : null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const readOnly = selected?.key === "owner"

  const dirty = useMemo(() => {
    if (!draft) return false
    if (!draft.id) return true
    const r = roles.find((x) => x.id === draft.id)!
    return (
      r.name !== draft.name ||
      (r.description ?? "") !== draft.description ||
      r.permissions.length !== draft.permissions.size ||
      r.permissions.some((p) => !draft.permissions.has(p))
    )
  }, [draft, roles])

  const pick = (r: Role) => {
    setSelectedId(r.id)
    setDraft(toDraft(r))
  }

  const toggle = (keys: string[], on: boolean) =>
    setDraft((d) => {
      if (!d) return d
      const next = new Set(d.permissions)
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)))
      return { ...d, permissions: next }
    })

  const save = async () => {
    if (!draft) return
    if (draft.name.trim().length < 2) return toast.error("Give the role a name")
    setSaving(true)
    try {
      const body = { name: draft.name, description: draft.description, permissions: [...draft.permissions] }
      if (draft.id) await api.patch(`/api/v1/roles/${draft.id}`, body)
      else {
        const res = await api.post<{ id: string }>("/api/v1/roles", body)
        setSelectedId(res.id)
        setDraft({ ...draft, id: res.id })
      }
      toast.success("Role saved")
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!draft?.id) return
    try {
      await api.delete(`/api/v1/roles/${draft.id}`)
      toast.success("Role deleted")
      setConfirmDelete(false)
      setSelectedId(null)
      setDraft(null)
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => {
            setSelectedId(null)
            setDraft({ id: null, name: "", description: "", permissions: new Set(["dashboard.view"]) })
          }}
        >
          <Plus /> New custom role
        </Button>
        <div className="overflow-hidden rounded-xl border bg-card">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => pick(r)}
              className={cn(
                "flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/50",
                r.id === selectedId && "bg-accent/60 hover:bg-accent/60",
              )}
            >
              <ShieldCheck className={cn("mt-0.5 size-4 shrink-0", r.id === selectedId ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-3" /> {r.users} · {r.key === "owner" ? "All" : r.permissions.length} permissions
                </p>
              </div>
              {r.isSystem && <StatusBadge>System</StatusBadge>}
            </button>
          ))}
        </div>
      </div>

      {draft ? (
        <div className="rounded-xl border bg-card">
          <div className="grid gap-4 border-b p-5 sm:grid-cols-2">
            <Field label="Role name" required>
              <Input value={draft.name} disabled={readOnly} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea
                rows={1}
                value={draft.description}
                disabled={readOnly}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
          </div>
          {readOnly ? (
            <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
              <Lock className="size-4" /> The Company Owner role always has full access to everything.
            </div>
          ) : (
            <div className="divide-y">
              {PERMISSION_MODULES.map((m) => {
                const keys = m.permissions.map((p) => p.key)
                const count = keys.filter((k) => draft.permissions.has(k)).length
                return (
                  <div key={m.module} className="grid gap-3 p-5 md:grid-cols-[200px_1fr]">
                    <label className="flex items-start gap-2.5">
                      <Checkbox
                        className="mt-0.5"
                        checked={count === keys.length ? true : count ? "indeterminate" : false}
                        onCheckedChange={(c) => toggle(keys, c === true)}
                      />
                      <div>
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {count} of {keys.length}
                        </p>
                      </div>
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {m.permissions.map((p) => (
                        <label key={p.key} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                          <Checkbox checked={draft.permissions.has(p.key)} onCheckedChange={(c) => toggle([p.key], c === true)} />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!readOnly && (
            <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-b-xl border-t bg-card/95 p-4 backdrop-blur">
              <div>
                {draft.id && !roles.find((r) => r.id === draft.id)?.isSystem && (
                  <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete role
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {draft.id && dirty && (
                  <Button variant="outline" onClick={() => pick(roles.find((r) => r.id === draft.id)!)}>
                    Discard
                  </Button>
                )}
                <Button onClick={save} disabled={!dirty || saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  {draft.id ? "Save changes" : "Create role"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed p-10 text-sm text-muted-foreground">
          Select a role to view its permissions.
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>Employees must be moved to another role first. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
