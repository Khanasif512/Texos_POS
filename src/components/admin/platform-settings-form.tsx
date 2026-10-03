"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { platformSettingsSchema, type PlatformSettingsInput, type PlatformSettingsOutput } from "@/lib/validation/billing"

export function PlatformSettingsForm({ initial }: { initial: PlatformSettingsOutput }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, reset } = useForm<PlatformSettingsInput, unknown, PlatformSettingsOutput>({
    resolver: zodResolver(platformSettingsSchema),
    defaultValues: initial,
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.put("/api/v1/admin/settings", v)
      toast.success("Settings saved")
      reset(v)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Subscription lifecycle</h2>
        <Field label="Free trial length (days)" htmlFor="trialDays" error={e.trialDays?.message} hint="Applies to companies that sign up from now on (TEN-02).">
          <Input id="trialDays" type="number" min={1} max={365} className="num" {...register("trialDays")} />
        </Field>
        <Field label="Payment grace period (days)" htmlFor="graceDays" error={e.graceDays?.message} hint="Full access after a renewal invoice is issued, before read-only (TEN-05).">
          <Input id="graceDays" type="number" min={0} max={90} className="num" {...register("graceDays")} />
        </Field>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Payment instructions</h2>
          <p className="text-sm text-muted-foreground">
            Shown to tenants on every unpaid invoice (manual bank transfer / bKash). Placeholders: <code className="text-xs">{"{invoice}"}</code>,{" "}
            <code className="text-xs">{"{amount}"}</code>, <code className="text-xs">{"{company}"}</code>.
          </p>
        </div>
        <Field htmlFor="instructions" error={e.instructions?.message}>
          <Textarea id="instructions" rows={12} className="font-mono text-[13px]" {...register("instructions")} />
        </Field>
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />} Save settings
        </Button>
      </div>
    </form>
  )
}
