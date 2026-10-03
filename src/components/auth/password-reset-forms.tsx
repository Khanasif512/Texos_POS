"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/shared/field"
import { PasswordInput } from "@/components/auth/password-input"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { forgotSchema, resetSchema } from "@/lib/validation/public"

export function ForgotForm() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) })
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.post("/api/v1/auth/forgot-password", v)
      setSent(true)
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  if (sent)
    return (
      <div className="rounded-xl border bg-muted/40 p-5 text-sm">
        <CheckCircle2 className="mb-3 size-6 text-success" />
        If an account exists for that email, a reset link is on its way. It is valid for one hour.
      </div>
    )
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoFocus className="h-10" {...register("email")} />
      </Field>
      <Button type="submit" className="h-10" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Send reset link
      </Button>
    </form>
  )
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token },
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.post("/api/v1/auth/reset-password", v)
      toast.success("Password updated. Please sign in.")
      router.replace("/login")
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  if (!token)
    return (
      <p className="text-sm text-muted-foreground">
        This link is missing its token.{" "}
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Request a new one
        </Link>
        .
      </p>
    )
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <Field label="New password" htmlFor="password" error={e.password?.message} hint="At least 8 characters with a letter and a number.">
        <PasswordInput id="password" autoFocus autoComplete="new-password" {...register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={e.confirm?.message}>
        <PasswordInput id="confirm" autoComplete="new-password" {...register("confirm")} />
      </Field>
      <Button type="submit" className="h-10" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Update password
      </Button>
    </form>
  )
}
