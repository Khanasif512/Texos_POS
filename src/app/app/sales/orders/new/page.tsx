import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { OrderForm, emptyDraft } from "@/components/sales-after/order-form"
import { ensurePermission, requireTenant } from "@/server/auth/context"

export const metadata: Metadata = { title: "New quotation / order" }

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireTenant("/app/sales/orders/new")
  ensurePermission(ctx, "sales.create")
  const type = (await searchParams).type === "order" ? "order" : "quotation"
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
      <OrderForm initial={emptyDraft(type, ctx.activeBranchId)} />
    </PageBody>
  )
}
