import type { MessageKey } from "./en"

/**
 * Translation keys for the sidebar (src/components/app/nav-config.ts is shared and stays English).
 * Top-level items and sub-items are keyed by href separately because a parent often shares its
 * href with its first child (e.g. "LC management" and "All LCs" are both /app/lc).
 * Entries missing here simply render the English title from nav-config.
 */
export const NAV_GROUP_KEYS: Record<string, MessageKey> = {
  Overview: "nav.group.overview",
  "Import & stock": "nav.group.import",
  Sales: "nav.group.sales",
  Money: "nav.group.money",
  Administration: "nav.group.admin",
}

export const NAV_ITEM_KEYS: Record<string, MessageKey> = {
  "/app": "nav.dashboard",
  "/app/pos": "nav.pos",
  "/app/lc": "nav.lc",
  "/app/purchases": "nav.purchasing",
  "/app/products": "nav.inventory",
  "/app/suppliers": "nav.suppliers",
  "/app/sales/invoices": "nav.sales",
  "/app/customers": "nav.customers",
  "/app/expenses": "nav.expenses",
  "/app/finance/cash-closing": "nav.finance",
  "/app/reports": "nav.reports",
  "/app/org/branches": "nav.org",
  "/app/settings/company": "nav.settings",
}

export const NAV_SUB_KEYS: Record<string, MessageKey> = {
  "/app/lc": "nav.lc.all",
  "/app/lc/new": "nav.lc.new",
  "/app/lc/delivery-charges": "nav.lc.deliveryCharges",
  "/app/purchases": "nav.purchases.orders",
  "/app/purchases/receipts": "nav.purchases.receipts",
  "/app/products": "nav.products",
  "/app/inventory": "nav.inventory.byBranch",
  "/app/inventory/adjustments": "nav.inventory.adjustments",
  "/app/inventory/transfers": "nav.inventory.transfers",
  "/app/inventory/low-stock": "nav.inventory.lowStock",
  "/app/inventory/opening": "nav.inventory.opening",
  "/app/sales/invoices": "nav.sales.invoices",
  "/app/sales/orders": "nav.sales.orders",
  "/app/sales/challans": "nav.sales.challans",
  "/app/sales/receipts": "nav.sales.receipts",
  "/app/sales/returns": "nav.sales.returns",
  "/app/sales/credit-notes": "nav.sales.creditNotes",
  "/app/expenses": "nav.expenses.daily",
  "/app/expenses/categories": "nav.expenses.categories",
  "/app/finance/cash-closing": "nav.finance.cashClosing",
  "/app/finance/profit-loss": "nav.finance.profitLoss",
  "/app/finance/payables": "nav.finance.payables",
  "/app/org/branches": "nav.org.branches",
  "/app/org/employees": "nav.org.employees",
  "/app/org/roles": "nav.org.roles",
  "/app/org/audit": "nav.org.audit",
  "/app/settings/company": "nav.settings.company",
  "/app/settings/billing": "nav.settings.billing",
  "/app/settings/notifications": "nav.settings.notifications",
}

/** Longest-prefix match: the href that best owns `pathname` (so /app/lc/new does not also light up /app/lc). */
export function bestMatch(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null
  for (const h of hrefs) {
    const hit = h === "/app" ? pathname === "/app" : pathname === h || pathname.startsWith(h + "/")
    if (hit && (!best || h.length > best.length)) best = h
  }
  return best
}
