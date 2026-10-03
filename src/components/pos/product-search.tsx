"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Barcode, Loader2, PackageSearch, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { VariationOption } from "@/components/shared/pickers"
import { api, errorMessage } from "@/lib/api-client"
import { money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ProductSearchHandle = { focus: () => void; refresh: () => void }

const exact = (v: VariationOption, term: string) => {
  const t = term.trim().toLowerCase()
  return !!t && (v.barcode?.toLowerCase() === t || v.sku.toLowerCase() === t)
}

/**
 * Left pane of the POS: type a name/SKU, or scan a barcode and press Enter (NFR-UX-02).
 * Arrow keys move the highlight, Enter adds the exact barcode/SKU match or the highlighted product.
 */
export const ProductSearch = forwardRef<ProductSearchHandle, { branchId: string; onAdd: (v: VariationOption) => void; inCart: Map<string, number> }>(
  function ProductSearch({ branchId, onAdd, inCart }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [q, setQ] = useState("")
    const [items, setItems] = useState<VariationOption[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [active, setActive] = useState(0)
    const [tick, setTick] = useState(0)
    const reqId = useRef(0)

    const load = useCallback(
      async (term: string) => {
        const id = ++reqId.current
        setLoading(true)
        try {
          const params = new URLSearchParams({ q: term, branchId, limit: "48" })
          const data = await api.get<VariationOption[]>(`/api/v1/lookup/variations?${params}`)
          if (id !== reqId.current) return null
          setItems(data)
          setError(null)
          setActive(0)
          return data
        } catch (e) {
          if (id === reqId.current) setError(errorMessage(e))
          return null
        } finally {
          if (id === reqId.current) setLoading(false)
        }
      },
      [branchId],
    )

    useEffect(() => {
      const t = setTimeout(() => void load(q), q ? 180 : 0)
      return () => clearTimeout(t)
    }, [q, load, tick])

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      refresh: () => setTick((n) => n + 1),
    }))

    const add = (v: VariationOption) => {
      onAdd(v)
      setQ("")
      inputRef.current?.focus()
    }

    const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (e.key === "ArrowRight" && q) return
        e.preventDefault()
        setActive((a) => Math.min(items.length - 1, a + 1))
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        if (e.key === "ArrowLeft" && q) return
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
      } else if (e.key === "Escape" && q) {
        e.preventDefault()
        e.stopPropagation()
        setQ("")
      } else if (e.key === "Enter") {
        e.preventDefault()
        const term = q.trim()
        if (!term) {
          if (items[active]) add(items[active])
          return
        }
        // scanners type fast and hit Enter before the debounce fires — search right away
        const hit = items.find((v) => exact(v, term))
        if (hit) return add(hit)
        const fresh = await load(term)
        if (!fresh) return
        const match = fresh.find((v) => exact(v, term)) ?? (fresh.length === 1 ? fresh[0] : null)
        if (match) add(match)
        else if (!fresh.length) setError(`No product matches "${term}"`)
      }
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setError(null)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search product name or SKU, or scan a barcode…"
            className="h-12 rounded-xl bg-card pr-24 pl-11 text-base shadow-xs md:text-base"
            aria-label="Search products"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2 text-muted-foreground">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {q ? (
              <button type="button" onClick={() => setQ("")} className="rounded p-0.5 hover:bg-muted" aria-label="Clear search">
                <X className="size-4" />
              </button>
            ) : (
              <Barcode className="size-5" />
            )}
          </div>
        </div>

        {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5 pb-2">
          {loading && !items.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px] rounded-xl" />
              ))}
            </div>
          ) : !items.length ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
              <PackageSearch className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{q ? "No matching products" : "No products yet"}</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {q ? "Try a different name, SKU or barcode." : "Add products and receive stock to start selling."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-4" role="listbox" aria-label="Products">
              {items.map((v, i) => {
                const inCartQty = inCart.get(v.id) ?? 0
                const out = v.stock <= 0
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onClick={() => add(v)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "group relative flex min-h-[104px] flex-col rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none",
                      i === active && "border-primary/60 ring-2 ring-primary/15",
                      out && "opacity-60",
                    )}
                  >
                    {inCartQty > 0 && (
                      <span className="num absolute top-2 right-2 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                        {quantity(inCartQty)}
                      </span>
                    )}
                    <span className="line-clamp-2 pr-6 text-[13px] leading-snug font-medium">{v.productName}</span>
                    <span className="mt-0.5 truncate text-xs text-muted-foreground">{v.name}</span>
                    <span className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <span className="num text-sm font-semibold">{money(v.salePrice)}</span>
                      <span className={cn("num text-[11px]", out ? "font-medium text-destructive" : v.stock < 5 ? "text-warning" : "text-muted-foreground")}>
                        {out ? "Out of stock" : `${quantity(v.stock)} ${v.unit}`}
                      </span>
                    </span>
                    <span className="num mt-1 truncate text-[10px] text-muted-foreground/80">{v.sku}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  },
)
