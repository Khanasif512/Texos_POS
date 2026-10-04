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
import { companySchema, type CompanyInput, type CompanyOutput } from "@/lib/validation/org"

export function CompanyForm({ initial, workspaceId }: { initial: CompanyInput; workspaceId: string }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, reset } = useForm<CompanyInput, unknown, CompanyOutput>({
    resolver: zodResolver(companySchema),
    defaultValues: initial,
  })
  const e = formState.errors
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.patch("/api/v1/company", v)
      toast.success("Company profile saved")
      reset(v as CompanyInput)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Business details</h2>
          <p className="text-xs text-muted-foreground">Workspace ID: {workspaceId}</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Company name" htmlFor="name" error={e.name?.message} required>
            <Input id="name" {...register("name")} />
          </Field>
          <Field label="Business type" htmlFor="businessType" error={e.businessType?.message}>
            <Input id="businessType" placeholder="e.g. Aluminium & glass importer" {...register("businessType")} />
          </Field>
          <Field label="Email" htmlFor="email" error={e.email?.message} required>
            <Input id="email" type="email" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={e.phone?.message}>
            <Input id="phone" {...register("phone")} />
          </Field>
          <Field label="Address" htmlFor="address" error={e.address?.message} className="sm:col-span-2">
            <Textarea id="address" rows={2} {...register("address")} />
          </Field>
        </div>
      </section>
      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Legal & documents</h2>
          <p className="text-xs text-muted-foreground">Shown in the footer of printed invoices.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Trade license no." htmlFor="tradeLicense" error={e.tradeLicense?.message}>
            <Input id="tradeLicense" {...register("tradeLicense")} />
          </Field>
          <Field label="BIN / VAT reg. no." htmlFor="binNumber" error={e.binNumber?.message}>
            <Input id="binNumber" {...register("binNumber")} />
          </Field>
          <Field
            label="Invoice cancel window (hours)"
            htmlFor="cancelWindowHours"
            error={e.cancelWindowHours?.message}
            hint="Staff can cancel an invoice only within this time after the sale. Owners can always cancel."
          >
            <Input id="cancelWindowHours" type="number" min={0} max={720} {...register("cancelWindowHours")} />
          </Field>
          <Field label="Invoice footer note" htmlFor="invoiceFooter" error={e.invoiceFooter?.message} className="sm:col-span-2">
            <Textarea id="invoiceFooter" rows={3} placeholder="e.g. Goods once sold are not returnable after 7 days." {...register("invoiceFooter")} />
          </Field>
        </div>
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  )
}
