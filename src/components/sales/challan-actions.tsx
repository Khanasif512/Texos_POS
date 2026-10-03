"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2, Pencil, Printer, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { useCan } from "@/components/app/app-context"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { challanUpdateSchema, type ChallanUpdateInput, type ChallanUpdateOutput } from "@/lib/validation/sales"

export type ChallanEditable = {
  id: string
  number: string
  status: string
  deliveryAddress: string | null
  deliveryPerson: string | null
  deliveryPhone: string | null
  vehicleNo: string | null
  deliveryDate: string | null
  showPrices: boolean
  note: string | null
  invoiceCancelled?: boolean
}

const toForm = (c: ChallanEditable, status?: "pending" | "delivered"): ChallanUpdateInput => ({
  deliveryAddress: c.deliveryAddress ?? "",
  deliveryPerson: c.deliveryPerson ?? "",
  deliveryPhone: c.deliveryPhone ?? "",
  vehicleNo: c.vehicleNo ?? "",
  deliveryDate: c.deliveryDate ? c.deliveryDate.slice(0, 10) : "",
  showPrices: c.showPrices,
  note: c.note ?? "",
  status: status ?? (c.status as "pending" | "delivered"),
})

/** DLV-02 row actions: edit delivery info, mark delivered / undelivered, print. */
export function ChallanActions({ challan, compact }: { challan: ChallanEditable; compact?: boolean }) {
  const router = useRouter()
  const canManage = useCan("delivery.manage")
  const [editing, setEditing] = useState<"pending" | "delivered" | null>(null)
  const [busy, setBusy] = useState(false)
  const delivered = challan.status === "delivered"

  const markUndelivered = async () => {
    if (!window.confirm(`Mark challan ${challan.number} as not delivered?`)) return
    setBusy(true)
    try {
      await api.patch(`/api/v1/challans/${challan.id}`, { ...toForm(challan), status: "pending" })
      toast.success(`Challan ${challan.number} marked undelivered`)
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {canManage && !delivered && !challan.invoiceCancelled && (
        <Button size="sm" variant={compact ? "ghost" : "outline"} onClick={() => setEditing("delivered")}>
          <CheckCircle2 /> Delivered
        </Button>
      )}
      {canManage && delivered && (
        <Button size="sm" variant="ghost" onClick={markUndelivered} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Undo2 />} Undeliver
        </Button>
      )}
      {canManage && (
        <Button size="icon-sm" variant="ghost" onClick={() => setEditing(challan.status as "pending")} aria-label={`Edit challan ${challan.number}`}>
          <Pencil />
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" asChild aria-label={`Print challan ${challan.number}`}>
        <a href={`/print/challan/${challan.id}`} target="_blank" rel="noopener">
          <Printer />
        </a>
      </Button>
      {editing && <ChallanDialog challan={challan} status={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ChallanDialog({ challan, status, onClose }: { challan: ChallanEditable; status: "pending" | "delivered"; onClose: () => void }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, control } = useForm<ChallanUpdateInput, unknown, ChallanUpdateOutput>({
    resolver: zodResolver(challanUpdateSchema),
    defaultValues: {
      ...toForm(challan, status),
      deliveryDate: challan.deliveryDate ? challan.deliveryDate.slice(0, 10) : status === "delivered" ? new Date().toLocaleDateString("en-CA") : "",
    },
  })
  const e = formState.errors
  const delivering = status === "delivered" && challan.status !== "delivered"
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.patch(`/api/v1/challans/${challan.id}`, v)
      toast.success(delivering ? `Challan ${challan.number} marked delivered` : "Delivery details saved")
      onClose()
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{delivering ? `Mark ${challan.number} delivered` : `Delivery details — ${challan.number}`}</DialogTitle>
          <DialogDescription>Shown on the printed challan for the delivery person and the receiver.</DialogDescription>
        </DialogHeader>
        <form id="challan-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Delivery person" htmlFor="ch-person" error={e.deliveryPerson?.message}>
            <Input id="ch-person" autoFocus {...register("deliveryPerson")} />
          </Field>
          <Field label="Phone" htmlFor="ch-phone" error={e.deliveryPhone?.message}>
            <Input id="ch-phone" inputMode="tel" {...register("deliveryPhone")} />
          </Field>
          <Field label="Vehicle no." htmlFor="ch-vehicle" error={e.vehicleNo?.message}>
            <Input id="ch-vehicle" placeholder="e.g. Dhaka Metro-Ta 11-2345" {...register("vehicleNo")} />
          </Field>
          <Field label="Delivery date" htmlFor="ch-date" error={e.deliveryDate?.message}>
            <Input id="ch-date" type="date" {...register("deliveryDate")} />
          </Field>
          <Field label="Delivery address" htmlFor="ch-address" error={e.deliveryAddress?.message} className="sm:col-span-2">
            <Textarea id="ch-address" rows={2} {...register("deliveryAddress")} />
          </Field>
          <Field label="Note" htmlFor="ch-note" error={e.note?.message} className="sm:col-span-2">
            <Input id="ch-note" {...register("note")} />
          </Field>
          <Controller
            control={control}
            name="showPrices"
            render={({ field }) => (
              <label className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Show prices on challan</p>
                  <p className="text-xs text-muted-foreground">Off by default — delivery staff see items and quantities only.</p>
                </div>
                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="challan-form" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {delivering ? "Mark delivered" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
