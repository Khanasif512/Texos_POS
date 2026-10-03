import "server-only"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const url = new URL(process.env.DATABASE_URL!)
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 10,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/** Models that carry a companyId column and must always be tenant-scoped (NFR-SEC-01). */
const TENANT_MODELS = new Set([
  "Branch", "Role", "User", "Supplier", "SupplierLedgerEntry", "SupplierPayment", "Category", "Product",
  "ProductVariation", "Customer", "CustomerLedgerEntry", "Lc", "LcProductLine", "LcCostItem",
  "LandedCostSnapshot", "PurchaseOrder", "GoodsReceipt", "InventoryBatch", "StockBalance",
  "StockLedgerEntry", "StockAdjustment", "StockTransfer", "SalesOrder", "Invoice", "Challan", "PrintLog",
  "MoneyReceipt", "SalesReturn", "CreditNote", "ExpenseCategory", "Expense", "CashClosing", "Notification",
  "Attachment", "Subscription", "BillingInvoice",
])

const WHERE_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate",
  "groupBy", "update", "updateMany", "delete", "deleteMany", "upsert",
])

/**
 * Prisma client whose every query on a tenant model is forced to `companyId`.
 * The companyId always comes from the verified session, never from request input.
 */
export function tenantDb(companyId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) return query(args)
          const a = (args ?? {}) as Record<string, unknown>
          if (WHERE_OPS.has(operation)) a.where = { ...(a.where as object), companyId }
          if (operation === "create") a.data = { ...(a.data as object), companyId }
          if (operation === "createMany") {
            const d = a.data
            a.data = Array.isArray(d) ? d.map((r) => ({ ...r, companyId })) : { ...(d as object), companyId }
          }
          if (operation === "upsert") a.create = { ...(a.create as object), companyId }
          return query(a as typeof args)
        },
      },
    },
  })
}

export type TenantDb = ReturnType<typeof tenantDb>
export type TxClient = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0]
