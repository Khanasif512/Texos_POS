"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/shared/field"
import { AuthHeading } from "@/components/auth/auth-shell"
import { PasswordInput } from "@/components/auth/password-input"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { signupSchema, type SignupInput } from "@/lib/validation/public"

type SignupResponse = { verificationRequired: true; verificationId: string; email: string } | { verificationRequired: false; email: string }

export function SignupFlow() {
  const params = useSearchParams()
  const router = useRouter()
  const plan = params.get("plan") ?? undefined
  const [pending, setPending] = useState<{ verificationId: string; email: string } | null>(null)

  const onSubmitted = (res: SignupResponse) => {
    if (res.verificationRequired) return setPending({ verificationId: res.verificationId, email: res.email })
    toast.success("Your workspace is ready")
    router.replace("/app")
    router.refresh()
  }

  if (pending) return <OtpStep {...pending} plan={plan} onBack={() => setPending(null)} />
  return <DetailsStep plan={plan} onSent={onSubmitted} />
}

function DetailsStep({ plan, onSent }: { plan?: string; onSent: (v: SignupResponse) => void }) {
  const { register, handleSubmit, formState, setError } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) })
  const e = formState.errors
  const onSubmit = handleSubmit(async (values) => {
    try {
      onSent(await api.post("/api/v1/auth/signup", { ...values, plan }))
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <>
      <AuthHeading title="Create your workspace" text="14-day free trial. No credit card required." />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field label="Company name" htmlFor="companyName" error={e.companyName?.message}>
          <Input id="companyName" autoFocus className="h-10" placeholder="e.g. GK Interior" {...register("companyName")} />
        </Field>
        <Field label="Your full name" htmlFor="ownerName" error={e.ownerName?.message}>
          <Input id="ownerName" autoComplete="name" className="h-10" {...register("ownerName")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Work email" htmlFor="email" error={e.email?.message}>
            <Input id="email" type="email" autoComplete="email" className="h-10" {...register("email")} />
          </Field>
          <Field label="Phone (optional)" htmlFor="phone" error={e.phone?.message}>
            <Input id="phone" autoComplete="tel" className="h-10" placeholder="+8801…" {...register("phone")} />
          </Field>
        </div>
        <Field label="Password" htmlFor="password" error={e.password?.message} hint="At least 8 characters with a letter and a number.">
          <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Button type="submit" className="mt-1 h-10" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Continue
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/legal/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}

function OtpStep({ verificationId, email, plan, onBack }: { verificationId: string; email: string; plan?: string; onBack: () => void }) {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""))
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(45)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const submit = async (code: string) => {
    setBusy(true)
    setError(undefined)
    try {
      await api.post("/api/v1/auth/verify", { verificationId, otp: code, plan })
      toast.success("Your workspace is ready")
      router.replace("/app")
      router.refresh()
    } catch (err) {
      setError(errorMessage(err))
      setDigits(Array(6).fill(""))
      refs.current[0]?.focus()
    } finally {
      setBusy(false)
    }
  }

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "")
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split("")
      const filled = [...next, ...Array(6 - next.length).fill("")]
      setDigits(filled)
      refs.current[Math.min(next.length, 5)]?.focus()
      if (next.length === 6) void submit(next.join(""))
      return
    }
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) refs.current[i + 1]?.focus()
    if (next.every((d) => d)) void submit(next.join(""))
  }

  const resend = async () => {
    try {
      await api.post("/api/v1/auth/resend", { verificationId })
      toast.success("A new code has been sent")
      setCooldown(45)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </button>
      <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <MailCheck className="size-6" />
      </span>
      <AuthHeading
        title="Check your email"
        text={
          <>
            We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
          </>
        }
      />
      <div className="flex justify-between gap-2" onPaste={(e) => (e.preventDefault(), setAt(0, e.clipboardData.getData("text")))}>
        {digits.map((d, i) => (
          <Input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={d}
            autoFocus={i === 0}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            disabled={busy}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus()
            }}
            className="num h-12 w-12 text-center text-lg font-semibold"
          />
        ))}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      <Button className="mt-6 h-10 w-full" disabled={busy || digits.some((d) => !d)} onClick={() => submit(digits.join(""))}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        Verify and create workspace
      </Button>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{" "}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <button onClick={resend} className="font-medium text-primary hover:underline">
            Resend code
          </button>
        )}
      </p>
    </>
  )
}
