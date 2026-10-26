"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Field } from "@/components/shared/field"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { signupSchema, type SignupInput } from "@/lib/validation/public"

type Plan = { code: string; name: string; isDefaultTrial: boolean }

export function CreateTenantForm({ plans }: { plans: Plan[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, formState, setError, setValue, control } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { plan: "" },
  })
  const errors = formState.errors

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    try {
      const { id } = await api.post<{ id: string }>("/api/v1/admin/tenants", values)
      toast.success("Tenant created")
      router.replace(`/admin/tenants/${id}`)
      router.refresh()
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  })

  const selectedPlan = useWatch({ control, name: "plan" }) || "default"

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl space-y-5 rounded-xl border bg-card p-5 sm:p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor="companyName" error={errors.companyName?.message} required>
          <Input id="companyName" autoFocus placeholder="e.g. GK Interior" {...register("companyName")} />
        </Field>
        <Field label="Owner name" htmlFor="ownerName" error={errors.ownerName?.message} required>
          <Input id="ownerName" autoComplete="name" {...register("ownerName")} />
        </Field>
        <Field label="Owner email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="example@gmail.com" {...register("email")} />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" autoComplete="tel" placeholder="+8801…" {...register("phone")} />
        </Field>
        <Field label="Initial password" htmlFor="password" error={errors.password?.message} required className="sm:col-span-2">
          <PasswordInput id="password" placeholder="At least 8 characters including a letter and a number" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field label="Trial plan" htmlFor="plan" error={errors.plan?.message} hint="The tenant will start with a trial subscription." className="sm:col-span-2">
          <Select
            value={selectedPlan}
            onValueChange={(value) => setValue("plan", value === "default" ? "" : value, { shouldValidate: true })}
          >
            <SelectTrigger id="plan" className="w-full">
              <SelectValue placeholder="Use the default trial plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default trial plan</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.code} value={plan.code}>
                  {plan.name}{plan.isDefaultTrial ? " (default trial)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/tenants")} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Create tenant
        </Button>
      </div>
    </form>
  )
}