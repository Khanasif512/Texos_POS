"use client"

import { AsyncCombobox } from "./async-combobox"
import { money, quantity } from "@/lib/format"

export type VariationOption = {
  id: string
  productId: string
  productName: string
  name: string
  sku: string
  barcode: string | null
  unit: string
  unitWeight: number
  salePrice: number
  wholesalePrice: number | null
  stock: number
}
export type CustomerOption = { id: string; code: string; name: string; phone: string | null; address: string | null; type: string; creditLimit: number; balance: number }
export type SupplierOption = { id: string; code: string; name: string; country: string | null; currency: string }
export type LcOption = { id: string; lcNumber: string; status: string; supplierName: string }

type P<T> = { value: T | null; onChange: (v: T | null) => void; disabled?: boolean; placeholder?: string; className?: string }

export function VariationPicker({ branchId, ...p }: P<VariationOption> & { branchId?: string }) {
  return (
    <AsyncCombobox<VariationOption>
      endpoint="/api/v1/lookup/variations"
      extraParams={{ branchId }}
      placeholder={p.placeholder ?? "Search product, SKU or barcode…"}
      renderValue={(v) => `${v.productName} — ${v.name}`}
      renderItem={(v) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm">
              {v.productName} <span className="text-muted-foreground">— {v.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">{v.sku}</p>
          </div>
          <div className="text-right text-xs">
            <p className="num">{money(v.salePrice)}</p>
            <p className={v.stock > 0 ? "num text-muted-foreground" : "text-destructive"}>
              {quantity(v.stock)} {v.unit}
            </p>
          </div>
        </div>
      )}
      {...p}
    />
  )
}

export function CustomerPicker(p: P<CustomerOption>) {
  return (
    <AsyncCombobox<CustomerOption>
      endpoint="/api/v1/lookup/customers"
      placeholder={p.placeholder ?? "Search customer by name or phone…"}
      renderValue={(c) => `${c.name}${c.phone ? ` · ${c.phone}` : ""}`}
      renderItem={(c) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm">{c.name}</p>
            <p className="text-xs text-muted-foreground">
              {c.code} {c.phone && `· ${c.phone}`}
            </p>
          </div>
          {c.balance !== 0 && <span className={`num text-xs ${c.balance > 0 ? "text-destructive" : "text-success"}`}>{money(Math.abs(c.balance))}</span>}
        </div>
      )}
      {...p}
    />
  )
}

export function SupplierPicker(p: P<SupplierOption>) {
  return (
    <AsyncCombobox<SupplierOption>
      endpoint="/api/v1/lookup/suppliers"
      placeholder={p.placeholder ?? "Search supplier…"}
      renderValue={(s) => s.name}
      renderItem={(s) => (
        <div>
          <p className="text-sm">{s.name}</p>
          <p className="text-xs text-muted-foreground">
            {s.code} · {s.country ?? "—"} · {s.currency}
          </p>
        </div>
      )}
      {...p}
    />
  )
}

export function LcPicker({ openOnly, ...p }: P<LcOption> & { openOnly?: boolean }) {
  return (
    <AsyncCombobox<LcOption>
      endpoint="/api/v1/lookup/lcs"
      extraParams={{ open: openOnly ? "1" : undefined }}
      placeholder={p.placeholder ?? "Search LC number…"}
      renderValue={(l) => l.lcNumber}
      renderItem={(l) => (
        <div>
          <p className="num text-sm">{l.lcNumber}</p>
          <p className="text-xs text-muted-foreground">
            {l.supplierName} · {l.status.replaceAll("_", " ")}
          </p>
        </div>
      )}
      {...p}
    />
  )
}
