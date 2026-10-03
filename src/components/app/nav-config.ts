import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  Settings,
  ShoppingCart,
  Ship,
  Truck,
  Users,
  Wallet,
  Store,
} from "lucide-react"
import type { PlanFeatures } from "@/lib/permissions"

export type NavLeaf = { title: string; href: string; perm?: string | string[]; feature?: keyof PlanFeatures }
export type NavItem = NavLeaf & { icon: LucideIcon; children?: NavLeaf[] }
export type NavGroup = { label: string; items: NavItem[] }

/** SRS Appendix A menu structure. */
export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/app", icon: LayoutDashboard, perm: "dashboard.view" },
      { title: "Point of sale", href: "/app/pos", icon: Store, perm: "sales.create" },
    ],
  },
  {
    label: "Import & stock",
    items: [
      {
        title: "LC management",
        href: "/app/lc",
        icon: Ship,
        perm: "lc.view",
        feature: "lc",
        children: [
          { title: "All LCs", href: "/app/lc" },
          { title: "New LC", href: "/app/lc/new", perm: "lc.create" },
          { title: "Delivery charges", href: "/app/lc/delivery-charges", perm: ["delivery.manage", "lc.update"] },
        ],
      },
      {
        title: "Purchasing",
        href: "/app/purchases",
        icon: ShoppingCart,
        perm: "purchase.view",
        feature: "purchase",
        children: [
          { title: "Purchase orders", href: "/app/purchases" },
          { title: "Goods receipts", href: "/app/purchases/receipts" },
        ],
      },
      {
        title: "Inventory",
        href: "/app/products",
        icon: Boxes,
        perm: "inventory.view",
        children: [
          { title: "Products", href: "/app/products" },
          { title: "Stock by branch", href: "/app/inventory" },
          { title: "Adjustments", href: "/app/inventory/adjustments", perm: "inventory.adjust" },
          { title: "Transfers", href: "/app/inventory/transfers", perm: "inventory.transfer", feature: "multiBranchTransfer" },
          { title: "Low stock", href: "/app/inventory/low-stock" },
        ],
      },
      { title: "Suppliers", href: "/app/suppliers", icon: Truck, perm: "suppliers.view" },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        title: "Sales",
        href: "/app/sales/invoices",
        icon: Receipt,
        perm: ["sales.view", "delivery.view"],
        children: [
          { title: "Invoices", href: "/app/sales/invoices", perm: "sales.view" },
          { title: "Quotations & orders", href: "/app/sales/orders", perm: "sales.view" },
          { title: "Challans", href: "/app/sales/challans", perm: ["delivery.view", "sales.view"] },
          { title: "Money receipts", href: "/app/sales/receipts", perm: "sales.view" },
          { title: "Returns", href: "/app/sales/returns", perm: "sales.view" },
          { title: "Credit notes", href: "/app/sales/credit-notes", perm: "sales.view" },
        ],
      },
      { title: "Customers", href: "/app/customers", icon: Users, perm: "customers.view" },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Expenses", href: "/app/expenses", icon: Wallet, perm: "expenses.view" },
      {
        title: "Finance",
        href: "/app/finance/cash-closing",
        icon: Calculator,
        perm: ["finance.view", "finance.cash_closing"],
        children: [
          { title: "Daily cash closing", href: "/app/finance/cash-closing", perm: "finance.cash_closing" },
          { title: "Profit & loss", href: "/app/finance/profit-loss", perm: "finance.view" },
          { title: "Supplier payables", href: "/app/finance/payables", perm: "finance.view" },
        ],
      },
      { title: "Reports", href: "/app/reports", icon: BarChart3, perm: ["reports.sales", "reports.stock", "reports.financial"] },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Organization",
        href: "/app/org/branches",
        icon: Building2,
        perm: ["org.branches", "org.employees", "org.roles", "org.audit"],
        children: [
          { title: "Branches", href: "/app/org/branches", perm: "org.branches" },
          { title: "Employees", href: "/app/org/employees", perm: "org.employees" },
          { title: "Roles & permissions", href: "/app/org/roles", perm: "org.roles" },
          { title: "Audit log", href: "/app/org/audit", perm: "org.audit" },
        ],
      },
      {
        title: "Settings",
        href: "/app/settings/company",
        icon: Settings,
        perm: ["settings.company", "settings.billing"],
        children: [
          { title: "Company profile", href: "/app/settings/company", perm: "settings.company" },
          { title: "Subscription & billing", href: "/app/settings/billing", perm: "settings.billing" },
        ],
      },
    ],
  },
]
