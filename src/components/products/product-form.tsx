"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, ChevronDown, Loader2, Lock, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/shared/field"
import { api, ApiError, applyFieldErrors, errorMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  PRODUCT_UNITS,
  productSchema,
  suggestSku,
  UNIT_LABELS,
  type ProductInput,
  type ProductOutput,
  type VariationInput,
} from "@/lib/validation/products"
import { CategoryDialog, type CategoryOption } from "./category-dialog"

/** Column template of the variations grid on large screens (stacked cards below lg). */
const GRID =
  "lg:grid-cols-[minmax(150px,1.6fr)_minmax(140px,1.3fr)_minmax(110px,1fr)_108px_108px_84px_52px_36px]"

const blankVariation = (): VariationInput => ({
  name: "",
  sku: "",
  barcode: "",
  unitWeight: 0,
  salePrice: 0,
  wholesalePrice: "",
  reorderLevel: 0,
  status: "active",
})

export function ProductForm({
  productId,
  initial,
  locks = {},
  categories: initialCategories,
  brands,
}: {
  productId?: string
  initial?: ProductInput
  /** variationId → reason it cannot be removed */
  locks?: Record<string, string>
  categories: CategoryOption[]
  brands: string[]
}) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [newCategory, setNewCategory] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, formState, setError, control, setValue } = useForm<ProductInput, unknown, ProductOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: initial ?? { name: "", categoryId: "none", unit: "pcs", status: "active", variations: [blankVariation()] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: "variations", keyName: "key" })
  const e = formState.errors
  const imageUrl = useWatch({ control, name: "imageUrl" })

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const onSubmit = handleSubmit(async (v) => {
    try {
      let productValues = v
      if (imageFile) {
        const formData = new FormData()
        formData.set("file", imageFile)
        const uploaded = await api.post<{ imageUrl: string }>("/api/v1/products/image", formData)
        productValues = { ...v, imageUrl: uploaded.imageUrl }
      }
      if (productId) {
        await api.patch(`/api/v1/products/${productId}`, productValues)
        toast.success("Product saved")
        router.push(`/app/products/${productId}`)
      } else {
        const res = await api.post<{ id: string }>("/api/v1/products", productValues)
        toast.success("Product created")
        router.push(`/app/products/${res.id}`)
      }
      router.refresh()
    } catch (err) {
      const hasFieldErrors = applyFieldErrors(err, setError)
      const fieldDetails =
        hasFieldErrors && err instanceof ApiError && err.details?.fields
          ? Object.entries(err.details.fields)
              .map(([field, message]) => `${field}: ${message}`)
              .join(" · ")
          : undefined
      toast.error(errorMessage(err), fieldDetails ? { description: fieldDetails } : undefined)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Product details</h2>
          <p className="text-xs text-muted-foreground">Shared by all variations of this product.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Product name" htmlFor="p-name" error={e.name?.message} required>
            <Input id="p-name" autoFocus={!productId} placeholder="e.g. Aluminium Profile Type-1" {...register("name")} />
          </Field>
          <Field label="Category" error={e.categoryId?.message}>
            <div className="flex gap-2">
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value ?? "none"} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorised</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setNewCategory(true)} aria-label="New category" className="shrink-0">
                <Plus />
              </Button>
            </div>
          </Field>
          <Field label="Unit" error={e.unit?.message} required>
            <Controller
              control={control}
              name="unit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Brand" htmlFor="p-brand" error={e.brand?.message}>
            <Controller
              control={control}
              name="brand"
              render={({ field }) => <BrandCombobox value={field.value ?? ""} onChange={field.onChange} brands={brands} />}
            />
          </Field>
          <Field label="Product image" htmlFor="p-image" error={e.imageUrl?.message}>
            <div className="flex min-w-0 items-center gap-2">
              <Input
                ref={imageInputRef}
                id="p-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="h-auto min-h-9 min-w-0 flex-1 file:mr-2"
                aria-describedby="p-image-help"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setImageFile(file)
                  setImagePreview(file ? URL.createObjectURL(file) : null)
                }}
              />
              {(imagePreview || imageUrl) && (
                <div className="flex items-center gap-2">
                  <img
                    src={imagePreview ?? imageUrl ?? ""}
                    alt="Product image preview"
                    className="size-14 rounded-md border object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={imageFile ? "Cancel image selection" : "Remove product image"}
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                      if (imageInputRef.current) imageInputRef.current.value = ""
                      if (!imageFile) setValue("imageUrl", "", { shouldDirty: true })
                    }}
                  >
                    {imageFile ? <X /> : <Trash2 />}
                  </Button>
                </div>
              )}
            </div>
            <p id="p-image-help" className="text-xs text-muted-foreground">
              Choose a PNG, JPEG, or WebP image up to 5 MB.
            </p>
          </Field>
          <Field label="Description" htmlFor="p-desc" error={e.description?.message} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="p-desc" rows={2} {...register("description")} />
          </Field>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-2 lg:col-span-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Inactive products are hidden from the POS and new documents. Stock and history are kept.</p>
                </div>
                <Switch checked={field.value === "active"} onCheckedChange={(c) => field.onChange(c ? "active" : "inactive")} />
              </label>
            )}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Variations</h2>
            <p className="text-xs text-muted-foreground">Each variation has its own SKU, price and stock (e.g. 6-inch profile, clear glass 5mm).</p>
          </div>
          <Button type="button" variant="outline" onClick={() => append(blankVariation())}>
            <Plus /> Add variation
          </Button>
        </div>
        <div className={cn("hidden gap-2 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid", GRID)}>
          <span>Variation name *</span>
          <span>SKU</span>
          <span className="text-right">Weight (kg)</span>
          <span className="text-right">Sale price ৳</span>
          <span className="text-right">Wholesale ৳</span>
          <span className="text-right">Reorder at</span>
          <span className="text-center">Active</span>
          <span />
        </div>
        {fields.map((f, i) => {
          const ve = e.variations?.[i]
          const lock = f.id ? locks[f.id] : undefined
          return (
            <div key={f.key} className={cn("grid grid-cols-2 gap-x-3 gap-y-2.5 border-t p-4 lg:items-start lg:gap-2 lg:px-4 lg:py-2.5", GRID)}>
              <Cell label="Variation name" error={ve?.name?.message} className="col-span-2 lg:col-span-1">
                <Input placeholder="e.g. 6-inch profile" aria-label="Variation name" {...register(`variations.${i}.name`)} />
              </Cell>
              <Cell label="SKU" error={ve?.sku?.message}>
                <SkuInput control={control} index={i} register={register} />
              </Cell>
              <Cell label="Weight (kg)" error={ve?.unitWeight?.message}>
                <Input type="number" step="0.0001" min="0" inputMode="decimal" className="text-right" aria-label="Unit weight" {...register(`variations.${i}.unitWeight`)} />
              </Cell>
              <Cell label="Sale price ৳" error={ve?.salePrice?.message}>
                <Input type="number" step="0.01" min="0" inputMode="decimal" className="text-right" aria-label="Sale price" {...register(`variations.${i}.salePrice`)} />
              </Cell>
              <Cell label="Wholesale ৳" error={ve?.wholesalePrice?.message}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="text-right"
                  placeholder="—"
                  aria-label="Wholesale price"
                  {...register(`variations.${i}.wholesalePrice`)}
                />
              </Cell>
              <Cell label="Reorder at" error={ve?.reorderLevel?.message}>
                <Input type="number" step="1" min="0" inputMode="decimal" className="text-right" aria-label="Reorder level" {...register(`variations.${i}.reorderLevel`)} />
              </Cell>
              <div className="flex items-center justify-between gap-2 lg:h-9 lg:justify-center">
                <span className="text-xs font-medium text-muted-foreground lg:hidden">Active</span>
                <Controller
                  control={control}
                  name={`variations.${i}.status`}
                  render={({ field }) => (
                    <Switch
                      checked={field.value === "active"}
                      onCheckedChange={(c) => field.onChange(c ? "active" : "inactive")}
                      aria-label="Variation active"
                    />
                  )}
                />
              </div>
              <div className="col-span-2 flex justify-end lg:col-span-1 lg:h-9 lg:items-center">
                {lock ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title={`This variation ${lock}. Set it to inactive instead of removing it.`}
                    onClick={() => {
                      setValue(`variations.${i}.status`, "inactive", { shouldDirty: true })
                      toast.info(`This variation ${lock}, so it was set to inactive instead of removed.`)
                    }}
                    aria-label="Variation has history"
                  >
                    <Lock className="text-muted-foreground" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                    aria-label="Remove variation"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                    <span className="lg:sr-only">Remove</span>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        {(e.variations?.message || e.variations?.root?.message) && (
          <p className="border-t px-5 py-3 text-xs font-medium text-destructive">{e.variations?.message ?? e.variations?.root?.message}</p>
        )}
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          Leave SKU blank to generate one from the names. SKUs are unique across your company.
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="outline" asChild>
          <Link href={productId ? `/app/products/${productId}` : "/app/products"}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="animate-spin" />}
          {productId ? "Save product" : "Create product"}
        </Button>
      </div>

      {newCategory && (
        <CategoryDialog
          row={null}
          categories={categories}
          onClose={() => setNewCategory(false)}
          onSaved={(c) => {
            setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
            setValue("categoryId", c.id, { shouldDirty: true })
          }}
        />
      )}
    </form>
  )
}

function BrandCombobox({ value, onChange, brands }: { value: string; onChange: (value: string) => void; brands: string[] }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const options = brands.filter((brand) => brand.toLowerCase().includes(value.trim().toLowerCase()))

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <Input
        id="p-brand"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="product-brand-options"
        aria-activedescendant={open && options[activeIndex] ? `product-brand-option-${activeIndex}` : undefined}
        placeholder="Select or enter a brand"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setActiveIndex(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((index) => Math.min(index + 1, options.length - 1))
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((index) => Math.max(index - 1, 0))
          } else if (event.key === "Enter" && open && activeIndex >= 0 && options[activeIndex]) {
            event.preventDefault()
            onChange(options[activeIndex])
            setOpen(false)
          } else if (event.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={open ? "Hide brand options" : "Show brand options"}
        aria-expanded={open}
        className="absolute right-0.5 top-0.5 text-muted-foreground"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <ChevronDown />
      </Button>
      {open && (
        <div
          id="product-brand-options"
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {options.length ? (
            options.map((brand, index) => (
              <button
                key={brand}
                id={`product-brand-option-${index}`}
                type="button"
                role="option"
                aria-selected={brand === value}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent",
                  index === activeIndex && "bg-accent",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(brand)
                  setOpen(false)
                }}
              >
                <Check className={cn("size-4", brand === value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{brand}</span>
              </button>
            ))
          ) : (
            <p className="px-2 py-2 text-sm text-muted-foreground">No matching brands. Your text will be saved as a new brand.</p>
          )}
        </div>
      )}
    </div>
  )
}

function Cell({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground lg:hidden">{label}</span>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}

/** SKU input that previews the auto-generated SKU as its placeholder. */
function SkuInput({
  control,
  index,
  register,
}: {
  control: Control<ProductInput, unknown, ProductOutput>
  index: number
  register: ReturnType<typeof useForm<ProductInput, unknown, ProductOutput>>["register"]
}) {
  const productName = useWatch({ control, name: "name" })
  const variationName = useWatch({ control, name: `variations.${index}.name` })
  const suggestion = productName ? suggestSku(productName, variationName ?? "") : "Auto"
  return <Input className="font-mono text-xs uppercase placeholder:normal-case" placeholder={suggestion} aria-label="SKU" {...register(`variations.${index}.sku`)} />
}
