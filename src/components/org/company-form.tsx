"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { api, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { companySchema, type CompanyInput, type CompanyOutput } from "@/lib/validation/org"

export function CompanyForm({ initial, workspaceId }: { initial: CompanyInput; workspaceId: string }) {
  const router = useRouter()
  const { register, handleSubmit, formState, setError, reset, setValue, control } = useForm<CompanyInput, unknown, CompanyOutput>({
    resolver: zodResolver(companySchema),
    defaultValues: initial,
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoInputKey, setLogoInputKey] = useState(0)
  const e = formState.errors
  const logoUrl = useWatch({ control, name: "logoUrl" })

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  const onSubmit = handleSubmit(async (v) => {
    try {
      let companyValues = v
      if (logoFile) {
        const formData = new FormData()
        formData.set("kind", "logo")
        formData.set("file", logoFile)
        const uploaded = await api.post<{ logoUrl: string }>("/api/v1/company/branding", formData)
        companyValues = { ...v, logoUrl: uploaded.logoUrl }
      }
      await api.patch("/api/v1/company", companyValues)
      toast.success("Company profile saved")
      reset({
        ...companyValues,
        businessType: companyValues.businessType ?? "",
        phone: companyValues.phone ?? "",
        address: companyValues.address ?? "",
        logoUrl: companyValues.logoUrl ?? "",
        tradeLicense: companyValues.tradeLicense ?? "",
        binNumber: companyValues.binNumber ?? "",
        invoiceFooter: companyValues.invoiceFooter ?? "",
      })
      setLogoFile(null)
      setLogoPreview(null)
      setLogoInputKey((key) => key + 1)
      router.refresh()
    } catch (err) {
      if (!applyFieldErrors(err, setError)) toast.error(errorMessage(err))
    }
  })
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Company branding</h2>
          <p className="text-xs text-muted-foreground">The company logo is shared across this workspace and used in navigation and printed documents.</p>
        </div>
        <div className="p-5">
          <div className="space-y-3">
            <input type="hidden" {...register("logoUrl")} />
            <Field label="Company logo" htmlFor="company-logo">
              <Input
                key={logoInputKey}
                id="company-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-describedby="company-logo-help"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setLogoFile(file)
                  setLogoPreview(file ? URL.createObjectURL(file) : null)
                }}
              />
            </Field>
            <p id="company-logo-help" className="text-xs text-muted-foreground">PNG, JPEG, or WebP up to 5 MB. Used on printed invoices and sales documents.</p>
            {(logoPreview || logoUrl) && (
              <img src={logoPreview ?? logoUrl ?? ""} alt="Company logo preview" className="size-20 rounded-md border bg-background p-2 object-contain" />
            )}
            {(logoUrl || logoFile) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setLogoFile(null)
                  setLogoPreview(null)
                  setLogoInputKey((key) => key + 1)
                  if (!logoFile) setValue("logoUrl", "", { shouldDirty: true, shouldValidate: true })
                }}
              >
                {logoFile ? <X /> : <Trash2 />}
                {logoFile ? "Cancel logo selection" : "Remove logo"}
              </Button>
            )}
          </div>
        </div>
      </section>
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
        <Button type="submit" disabled={formState.isSubmitting || (!formState.isDirty && !logoFile)}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  )
}
