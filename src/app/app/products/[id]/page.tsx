import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Boxes } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatCard } from "@/components/shared/stat-card"
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge"
import { ProductActions, VariationMenu } from "@/components/products/product-actions"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { AppError } from "@/server/errors"
import { getProductDetail } from "@/server/modules/products/service"
import { date, money, quantity } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Product" }

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireTenant(`/app/products/${id}`)
  ensurePermission(ctx, "inventory.view")
  const d = await getProductDetail(ctx, tenantDb(ctx.companyId), id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound()
    throw e
  })
  const p = d.product
  const totalStock = d.variations.reduce((a, v) => a + v.totalStock, 0)
  const lowCount = d.variations.filter((v) => v.status === "active" && v.reorderLevel > 0 && v.totalStock <= v.reorderLevel).length
  const stockValue = d.showCost ? d.variations.reduce((a, v) => a + (v.stockValue ?? 0), 0) : null
  const branchTotals = d.branches.map((b) => d.variations.reduce((a, v) => a + (v.stockByBranch[b.id] ?? 0), 0))

  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/products", label: "Products" }}
        title={
          <span className="flex items-center gap-2">
            {p.name}
            <ActiveBadge status={p.status} />
          </span>
        }
        description={[p.category?.name ?? "Uncategorised", p.brand, `sold in ${p.unit}`].filter(Boolean).join(" · ")}
        actions={<ProductActions id={p.id} name={p.name} deletable={d.deletable} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Variations" value={String(d.variations.length)} hint={`${d.variations.filter((v) => v.status === "active").length} active`} />
        <StatCard label="Total stock" value={`${quantity(totalStock)} ${p.unit}`} hint={`Across ${d.branches.length} branch(es) you can see`} />
        <StatCard
          label="Low stock"
          value={String(lowCount)}
          tone={lowCount ? "warning" : "default"}
          hint={lowCount ? "Variation(s) at or below reorder level" : "All above reorder level"}
        />
        {stockValue != null ? (
          <StatCard label="Stock value at cost" value={money(stockValue)} hint="Available batches × landed cost" />
        ) : (
          <StatCard label="Last updated" value={date(p.updatedAt)} hint={`Created ${date(p.createdAt)}`} />
        )}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Variations & stock by branch</h2>
          <p className="text-xs text-muted-foreground">
            Each variation has independent price and stock (INV-01).{d.showCost ? " Average cost is weighted over available batches." : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-10 text-xs">Variation</TableHead>
                <TableHead className="h-10 text-right text-xs">Sale price</TableHead>
                <TableHead className="h-10 text-right text-xs">Wholesale</TableHead>
                {d.showCost && <TableHead className="h-10 text-right text-xs">Avg cost</TableHead>}
                <TableHead className="h-10 text-right text-xs">Weight</TableHead>
                {d.branches.map((b) => (
                  <TableHead key={b.id} className="h-10 text-right text-xs whitespace-nowrap" title={b.name}>
                    {b.code}
                  </TableHead>
                ))}
                <TableHead className="h-10 text-right text-xs">Total</TableHead>
                <TableHead className="h-10 text-xs">Status</TableHead>
                <TableHead className="h-10 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.variations.map((v) => {
                const low = v.status === "active" && v.reorderLevel > 0 && v.totalStock <= v.reorderLevel
                return (
                  <TableRow key={v.id}>
                    <TableCell className="min-w-[200px] py-3">
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{v.sku}</span>
                        {v.barcode && <> · {v.barcode}</>}
                      </p>
                    </TableCell>
                    <TableCell className="num py-3 text-right">{money(v.salePrice)}</TableCell>
                    <TableCell className="num py-3 text-right text-muted-foreground">{v.wholesalePrice == null ? "—" : money(v.wholesalePrice)}</TableCell>
                    {d.showCost && (
                      <TableCell className="num py-3 text-right">
                        {v.avgCost == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {money(v.avgCost)}
                            {v.salePrice > 0 && (
                              <p className={cn("text-[11px]", v.salePrice >= v.avgCost ? "text-success" : "text-destructive")}>
                                {(((v.salePrice - v.avgCost) / v.salePrice) * 100).toFixed(1)}% margin
                              </p>
                            )}
                          </>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="num py-3 text-right whitespace-nowrap text-muted-foreground">{v.unitWeight ? `${quantity(v.unitWeight)} kg` : "—"}</TableCell>
                    {d.branches.map((b) => {
                      const q = v.stockByBranch[b.id] ?? 0
                      return (
                        <TableCell key={b.id} className={cn("num py-3 text-right", !q && "text-muted-foreground")}>
                          {quantity(q)}
                        </TableCell>
                      )
                    })}
                    <TableCell className="py-3 text-right whitespace-nowrap">
                      <span className={cn("num font-medium", low && "text-warning")}>{quantity(v.totalStock)}</span>
                      {v.reorderLevel > 0 && <p className="text-[11px] text-muted-foreground">reorder at {quantity(v.reorderLevel)}</p>}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-wrap gap-1">
                        <ActiveBadge status={v.status} />
                        {low && <StatusBadge tone="warning">Low</StatusBadge>}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <VariationMenu id={v.id} name={v.name} status={v.status} lock={v.lock} isLast={d.variations.length === 1} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            {d.variations.length > 1 && (
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={d.showCost ? 5 : 4} className="py-2.5 text-xs font-medium text-muted-foreground">
                    Total
                  </TableCell>
                  {branchTotals.map((t, i) => (
                    <TableCell key={d.branches[i].id} className="num py-2.5 text-right font-medium">
                      {quantity(t)}
                    </TableCell>
                  ))}
                  <TableCell className="num py-2.5 text-right font-semibold">{quantity(totalStock)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </section>

      {(p.description || p.imageUrl) && (
        <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:flex-row">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name} className="size-32 shrink-0 rounded-lg border object-cover" />
          ) : (
            <span className="flex size-32 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Boxes className="size-8" />
            </span>
          )}
          <div>
            <h2 className="font-semibold">About this product</h2>
            <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{p.description ?? "No description."}</p>
          </div>
        </section>
      )}
    </PageBody>
  )
}
