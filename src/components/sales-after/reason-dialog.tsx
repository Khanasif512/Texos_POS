"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { ApiError, api, errorMessage } from "@/lib/api-client"

/**
 * Destructive action that needs a written reason (cancel receipt / cancel order / reject return).
 * Posts `{ [field]: reason }` to `endpoint`; the server message is shown as the toast.
 */
export function ReasonDialogButton({
  label,
  title,
  description,
  endpoint,
  field = "reason",
  confirmLabel,
  placeholder,
  icon = "ban",
  variant = "destructive",
  successMessage,
}: {
  label: string
  title: string
  description: React.ReactNode
  endpoint: string
  field?: "reason" | "note"
  confirmLabel: string
  placeholder?: string
  icon?: "ban" | "x-circle"
  variant?: "destructive" | "outline"
  successMessage: string | ((data: Record<string, unknown>) => string)
}) {
  const router = useRouter()
  const Icon = icon === "x-circle" ? XCircle : Ban
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (reason.trim().length < 3) return setError("Give a reason (at least 3 characters)")
    setBusy(true)
    setError(null)
    try {
      const data = await api.post<Record<string, unknown>>(endpoint, { [field]: reason.trim() })
      toast.success(typeof successMessage === "function" ? successMessage(data) : successMessage)
      setOpen(false)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.details?.fields?.[field]) setError(err.details.fields[field])
      else toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Icon /> {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason" htmlFor="reason-text" error={error ?? undefined} required>
            <Textarea id="reason-text" rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} maxLength={255} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Keep it
            </Button>
            <Button onClick={submit} disabled={busy} className="bg-destructive text-white hover:bg-destructive/90">
              {busy && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
