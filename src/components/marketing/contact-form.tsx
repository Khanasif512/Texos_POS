"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { contactSchema, type ContactInput } from "@/lib/validation/public"
import { toast } from "sonner"

export function ContactForm() {
  const [sent, setSent] = useState(false)
  const form = useForm<ContactInput>({ resolver: zodResolver(contactSchema) })
  const { register, handleSubmit, formState, setError } = form

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/api/v1/public/contact", values)
      setSent(true)
    } catch (e) {
      if (!applyFieldErrors(e, setError)) toast.error(errorMessage(e))
    }
  })

  if (sent)
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <h3 className="mt-4 text-xl font-semibold">Thanks — message received</h3>
        <p className="mt-2 max-w-sm text-muted-foreground">Our team will get back to you within one business day.</p>
      </div>
    )

  const e = formState.errors
  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={e.name?.message} required>
          <Input id="name" className="h-10" {...register("name")} />
        </Field>
        <Field label="Work email" htmlFor="email" error={e.email?.message} required>
          <Input id="email" type="email" className="h-10" {...register("email")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={e.phone?.message}>
          <Input id="phone" className="h-10" {...register("phone")} />
        </Field>
        <Field label="Company" htmlFor="company" error={e.company?.message}>
          <Input id="company" className="h-10" {...register("company")} />
        </Field>
      </div>
      <Field label="How can we help?" htmlFor="message" error={e.message?.message} required>
        <Textarea id="message" rows={5} {...register("message")} />
      </Field>
      <Button type="submit" className="h-10 sm:justify-self-start sm:px-6" disabled={formState.isSubmitting}>
        {formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Send message
      </Button>
    </form>
  )
}
