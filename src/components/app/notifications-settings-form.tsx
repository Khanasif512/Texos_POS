"use client"

import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Info, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/components/i18n/i18n-provider"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import type { MessageKey } from "@/lib/i18n"

export type NotificationPrefsValues = {
  lowStock: boolean
  lcArrival: boolean
  overdueCredit: boolean
  subscription: boolean
  email: boolean
  creditDueDays: number
}

type ToggleKey = Exclude<keyof NotificationPrefsValues, "creditDueDays">

const IN_APP: { key: ToggleKey; label: MessageKey; hint: MessageKey }[] = [
  { key: "lowStock", label: "notifSettings.lowStock", hint: "notifSettings.lowStockHint" },
  { key: "lcArrival", label: "notifSettings.lcArrival", hint: "notifSettings.lcArrivalHint" },
  { key: "overdueCredit", label: "notifSettings.overdueCredit", hint: "notifSettings.overdueCreditHint" },
  { key: "subscription", label: "notifSettings.subscription", hint: "notifSettings.subscriptionHint" },
]

/** Company-wide alert preferences stored in Company.settings (AUD-02). */
export function NotificationsSettingsForm({ initial, canEdit }: { initial: NotificationPrefsValues; canEdit: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const { control, register, handleSubmit, formState, reset, setError } = useForm<NotificationPrefsValues>({ defaultValues: initial })
  const e = formState.errors
  const overdueOn = useWatch({ control, name: "overdueCredit" })

  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = await api.put<NotificationPrefsValues>("/api/v1/preferences/notifications", { ...v, creditDueDays: Number(v.creditDueDays) })
      toast.success(t("notifSettings.saved"))
      reset(saved)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  const toggle = (key: ToggleKey, label: MessageKey, hint: MessageKey, extra?: React.ReactNode) => (
    <div key={key} className="px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={`pref-${key}`} className="text-sm font-medium">
            {t(label)}
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(hint)}</p>
        </div>
        <Controller
          control={control}
          name={key}
          render={({ field }) => (
            <Switch id={`pref-${key}`} checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} className="mt-0.5" />
          )}
        />
      </div>
      {extra}
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {!canEdit && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" /> {t("notifSettings.readOnly")}
        </div>
      )}

      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">{t("notifSettings.inApp")}</h2>
          <p className="text-xs text-muted-foreground">{t("notifSettings.inAppHint")}</p>
        </div>
        <div className="divide-y">
          {IN_APP.map((row) =>
            toggle(
              row.key,
              row.label,
              row.hint,
              row.key === "overdueCredit" ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <label htmlFor="creditDueDays" className="text-xs font-medium">
                    {t("notifSettings.creditDays")}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="creditDueDays"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={365}
                      className="num h-8 w-20"
                      disabled={!canEdit || !overdueOn}
                      aria-invalid={!!e.creditDueDays}
                      {...register("creditDueDays", { valueAsNumber: true, required: true, min: 1, max: 365 })}
                    />
                    <span className="text-xs text-muted-foreground">{t("notifSettings.days")}</span>
                  </div>
                  <p className="w-full text-xs text-muted-foreground">{e.creditDueDays?.message || t("notifSettings.creditDaysHint")}</p>
                </div>
              ) : undefined,
            ),
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">{t("notifSettings.emailSection")}</h2>
          <p className="text-xs text-muted-foreground">{t("notifSettings.emailHint")}</p>
        </div>
        {toggle("email", "notifSettings.email", "notifSettings.emailToggleHint")}
      </section>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
            {formState.isSubmitting && <Loader2 className="animate-spin" />}
            {formState.isSubmitting ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </div>
      )}
    </form>
  )
}
