import type { Metadata } from "next"
import { addDays, format } from "date-fns"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { OrderForm, type OrderDraft } from "@/components/sales-after/order-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"

export const metadata: Metadata = { title: "New quotation / order" }

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireTenant("/app/sales/orders/new")
  ensurePermission(ctx, "sales.create")
  const type = (await searchParams).type === "order" ? "order" : "quotation"
  const today = new Date()
  const initial: OrderDraft = {
    type,
    branchId: ctx.activeBranchId,
    customer: null,
    date: format(today, "yyyy-MM-dd"),
    validUntil: type === "quotation" ? format(addDays(today, 15), "yyyy-MM-dd") : "",
    discount: "",
    note: "",
    lines: [{ key: crypto.randomUUID(), variation: null, quantity: "1", unitPrice: "", discount: "" }],
  }
  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/sales/orders", label: "Quotations & orders" }}
        title={type === "order" ? "New sales order" : "New quotation"}
        description={
          type === "order"
            ? "A confirmed order for a customer. Stock moves only when it is converted to an invoice at the POS."
            : "A price quote you can print and send. It does not reserve stock."
        }
      />
      <OrderForm initial={initial} />
    </PageBody>
  )
}
