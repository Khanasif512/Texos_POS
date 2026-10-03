"use client"

import { useEffect, useRef } from "react"
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import { lineAmounts, toNum, type CartLine } from "./pos-types"

type Patch = Partial<Pick<CartLine, "qty" | "price" | "discount">>

export function Cart({
  lines,
  canEditPrice,
  focusId,
  errorId,
  onChange,
  onRemove,
}: {
  lines: CartLine[]
  canEditPrice: boolean
  /** line to scroll into view (last added) */
  focusId: string | null
  /** line rejected by the server (stock) */
  errorId: string | null
  onChange: (variationId: string, patch: Patch) => void
  onRemove: (variationId: string) => void
}) {
  if (!lines.length)
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShoppingBasket className="size-6" />
        </span>
        <p className="mt-3 text-sm font-medium">Cart is empty</p>
        <p className="mt-1 text-xs text-muted-foreground">Scan a barcode or click a product to add it.</p>
      </div>
    )
  return (
    <ul className="divide-y">
      {lines.map((l, i) => (
        <CartRow
          key={l.variationId}
          index={i}
          line={l}
          canEditPrice={canEditPrice}
          focus={focusId === l.variationId}
          error={errorId === l.variationId}
          onChange={(p) => onChange(l.variationId, p)}
          onRemove={() => onRemove(l.variationId)}
        />
      ))}
    </ul>
  )
}

function CartRow({
  line,
  index,
  canEditPrice,
  focus,
  error,
  onChange,
  onRemove,
}: {
  line: CartLine
  index: number
  canEditPrice: boolean
  focus: boolean
  error: boolean
  onChange: (p: Patch) => void
  onRemove: () => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  const a = lineAmounts(line)
  const overStock = a.qty > line.stock
  const belowList = a.price < line.listPrice
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focus, line.qty])

  const step = (d: number) => {
    const next = Math.max(0, +(toNum(line.qty) + d).toFixed(3))
    if (next <= 0) return onRemove()
    onChange({ qty: String(next) })
  }

  return (
    <li ref={ref} className={cn("group px-4 py-3 transition-colors", (overStock || error) && "bg-destructive/5", focus && "bg-primary/[0.03]")}>
      <div className="flex items-start gap-2">
        <span className="num mt-0.5 w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-tight font-medium">{line.productName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {line.name} · <span className="num">{line.sku}</span>
          </p>
        </div>
        <p className="num shrink-0 text-sm font-semibold">{money(a.total)}</p>
        <Button
          variant="ghost"
          size="icon-xs"
          className="-mr-1 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${line.productName}`}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-7">
        <div className="flex items-center rounded-lg border bg-background">
          <button type="button" className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground" onClick={() => step(-1)} aria-label="Decrease quantity">
            <Minus className="size-3.5" />
          </button>
          <input
            value={line.qty}
            onChange={(e) => onChange({ qty: e.target.value.replace(/[^0-9.]/g, "") })}
            onFocus={(e) => e.target.select()}
            inputMode="decimal"
            className="num h-7 w-12 border-x bg-transparent text-center text-sm outline-none focus:bg-muted/40"
            aria-label="Quantity"
          />
          <button type="button" className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground" onClick={() => step(1)} aria-label="Increase quantity">
            <Plus className="size-3.5" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">×</span>
        {canEditPrice ? (
          <Input
            value={line.price}
            onChange={(e) => onChange({ price: e.target.value.replace(/[^0-9.]/g, "") })}
            onFocus={(e) => e.target.select()}
            inputMode="decimal"
            className={cn("num h-7 w-24 px-2 text-right text-sm", belowList && "border-warning/60")}
            aria-label="Unit price"
          />
        ) : (
          <span className="num text-sm">{money(a.price)}</span>
        )}
        {canEditPrice && (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Disc
            <Input
              value={line.discount}
              onChange={(e) => onChange({ discount: e.target.value.replace(/[^0-9.]/g, "") })}
              onFocus={(e) => e.target.select()}
              inputMode="decimal"
              placeholder="0"
              className="num h-7 w-20 px-2 text-right text-sm"
              aria-label="Line discount"
            />
          </label>
        )}
      </div>
      {(overStock || error || a.discount > a.gross) && (
        <p className="mt-1.5 pl-7 text-xs font-medium text-destructive">
          {a.discount > a.gross
            ? "Discount is more than the line amount"
            : `Only ${quantity(line.stock)} ${line.unit} in stock at this branch`}
        </p>
      )}
    </li>
  )
}
