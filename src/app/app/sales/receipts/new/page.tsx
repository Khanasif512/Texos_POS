import type { Metadata } from "next"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { ReceiptForm } from "@/components/sales-after/receipt-form"
import type { CustomerOption } from "@/components/shared/pickers"
import { ensurePermission, requireTenant } from "@/server/auth/context"
import { tenantDb } from "@/server/db"
import { num } from "@/server/decimal"

export const metadata: Metadata = { title: "New money receipt" }

export default async function NewReceiptPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireTenant("/app/sales/receipts/new")
  ensurePermission(ctx, "sales.receipt")
  const sp = await searchParams
  const db = tenantDb(ctx.companyId)
  let customerId = sp.customerId
  let invoiceNumber: string | null = null
  if (sp.invoiceId) {
    const inv = await db.invoice.findFirst({ where: { id: sp.invoiceId, branchId: { in: ctx.branchIds } }, select: { customerId: true, number: true } })
    if (inv?.customerId) customerId = inv.customerId
    invoiceNumber = inv?.number ?? null
  }
  const c = customerId ? await db.customer.findFirst({ where: { id: customerId } }) : null
  const initialCustomer: CustomerOption | null = c
    ? { id: c.id, code: c.code, name: c.name, phone: c.phone, address: c.address, type: c.type, creditLimit: num(c.creditLimit), balance: num(c.balance) }
    : null
  return (
    <PageBody>
      <PageHeader
        back={{ href: "/app/sales/receipts", label: "Money receipts" }}
        title="New money receipt"
        description={
          invoiceNumber
            ? `Payment against ${invoiceNumber}. Anything over the invoice due is applied to older invoices or kept as an advance.`
            : "Record a payment from a customer. It settles their oldest invoices first; any remainder is kept as an advance."
        }
      />
      <ReceiptForm initialCustomer={initialCustomer} invoiceId={sp.invoiceId} />
    </PageBody>
  )
}
