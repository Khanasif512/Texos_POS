import Link from "next/link"
import { money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

type Line = {
  id: string
  variationId: string
  productName: string
  variationName: string
  sku: string
  unit: string
  quantity: number
  unitCost: number | null
  value: number | null
}

/** Read-only line table for stock documents (adjustments, transfers). */
export function DocLines({ lines, showCost, signed, total }: { lines: Line[]; showCost: boolean; signed?: boolean; total?: number | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-5 py-2.5 font-medium">Product</th>
            <th className="px-3 py-2.5 text-right font-medium">{signed ? "Change" : "Quantity"}</th>
            {showCost && <th className="px-3 py-2.5 text-right font-medium">Unit cost</th>}
            {showCost && <th className="px-5 py-2.5 text-right font-medium">Value</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="px-5 py-3">
                <Link href={`/app/inventory/${l.variationId}`} className="font-medium hover:underline">
                  {l.productName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {l.variationName} · <span className="num">{l.sku}</span>
                </p>
              </td>
              <td className={cn("num px-3 py-3 text-right font-medium", signed && (l.quantity > 0 ? "text-success" : "text-destructive"))}>
                {signed && (l.quantity > 0 ? "+" : "−")}
                {quantity(Math.abs(l.quantity))} <span className="text-xs font-normal text-muted-foreground">{l.unit}</span>
              </td>
              {showCost && <td className="num px-3 py-3 text-right text-muted-foreground">{money(l.unitCost)}</td>}
              {showCost && <td className="num px-5 py-3 text-right">{money(l.value)}</td>}
            </tr>
          ))}
        </tbody>
        {showCost && total != null && (
          <tfoot>
            <tr className="border-t bg-muted/20 font-semibold">
              <td className="px-5 py-3" colSpan={3}>
                {signed ? "Net value" : "Total value at cost"}
              </td>
              <td className="num px-5 py-3 text-right">{money(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Key/value details card. */
export function DetailsCard({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <section className="h-fit rounded-xl border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Details</h2>
      </div>
      <dl className="space-y-3 p-5 text-sm">
        {items.map((i) => (
          <div key={i.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{i.label}</dt>
            <dd className="text-right">{i.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
