"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/shared/field"
import { PasswordInput } from "@/components/auth/password-input"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { loginSchema, type LoginInput } from "@/lib/validation/public"

export function LoginForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const { register, handleSubmit, formState, setError } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
  const e = formState.errors

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await api.post<{ redirect: string }>(admin ? "/api/v1/admin/auth/login" : "/api/v1/auth/login", values)
      const next = params.get("next")
      const target = next && next.startsWith(admin ? "/admin" : "/app") ? next : res.redirect
      router.replace(target)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <Field label="Email" htmlFor="email" error={e.email?.message}>
        <Input id="email" type="email" autoComplete="email" autoFocus className="h-10" {...register("email")} />
      </Field>
      <Field
        label={
          <span className="flex w-full items-center justify-between">
            Password
            {!admin && (
              <Link href="/forgot-password" className="text-xs font-normal text-primary hover:underline">
                Forgot password?
              </Link>
            )}
          </span>
        }
        htmlFor="password"
        error={e.password?.message}
      >
        <PasswordInput id="password" autoComplete="current-password" {...register("password")} />
      </Field>
      <Button type="submit" className="h-10" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  )
}
