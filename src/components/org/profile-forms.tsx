"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/shared/field"
import { PasswordInput } from "@/components/auth/password-input"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { changePasswordSchema, profileSchema } from "@/lib/validation/org"

export function ProfileForms({ name, phone, email }: { name: string; phone: string; email: string }) {
  const router = useRouter()
  const profile = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name, phone },
  })
  const pwd = useForm<z.input<typeof changePasswordSchema>>({ resolver: zodResolver(changePasswordSchema) })

  const saveProfile = profile.handleSubmit(async (v) => {
    try {
      await api.patch("/api/v1/profile", v)
      toast.success("Profile saved")
      router.refresh()
    } catch (e) {
      if (!applyFieldErrors(e, profile.setError)) toast.error(errorMessage(e))
    }
  })
  const savePwd = pwd.handleSubmit(async (v) => {
    try {
      await api.post("/api/v1/profile/password", v)
      toast.success("Password changed. Other devices were signed out.")
      pwd.reset({ current: "", password: "", confirm: "" })
    } catch (e) {
      if (!applyFieldErrors(e, pwd.setError)) toast.error(errorMessage(e))
    }
  })

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="rounded-xl border bg-card" noValidate>
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Personal details</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name" error={profile.formState.errors.name?.message}>
            <Input {...profile.register("name")} />
          </Field>
          <Field label="Phone" error={profile.formState.errors.phone?.message}>
            <Input {...profile.register("phone")} />
          </Field>
          <Field label="Email" hint="Ask your company owner to change your login email." className="sm:col-span-2">
            <Input value={email} disabled />
          </Field>
        </div>
        <div className="flex justify-end border-t px-5 py-3">
          <Button type="submit" disabled={profile.formState.isSubmitting || !profile.formState.isDirty}>
            {profile.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>
      </form>

      <form onSubmit={savePwd} className="rounded-xl border bg-card" noValidate>
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Change password</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Current password" error={pwd.formState.errors.current?.message}>
            <PasswordInput autoComplete="current-password" {...pwd.register("current")} />
          </Field>
          <Field label="New password" error={pwd.formState.errors.password?.message}>
            <PasswordInput autoComplete="new-password" {...pwd.register("password")} />
          </Field>
          <Field label="Confirm" error={pwd.formState.errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...pwd.register("confirm")} />
          </Field>
        </div>
        <div className="flex justify-end border-t px-5 py-3">
          <Button type="submit" disabled={pwd.formState.isSubmitting}>
            {pwd.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Update password
          </Button>
        </div>
      </form>
    </div>
  )
}
