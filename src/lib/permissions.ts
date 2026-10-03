/** Permission catalog shared by server (enforcement) and client (UI visibility). SRS §9 + AUTH-02. */

export type PermissionDef = { key: string; module: string; action: string; label: string }

const def = (module: string, action: string, label: string): PermissionDef => ({
  key: `${module}.${action}`,
  module,
  action,
  label,
})

export const PERMISSION_MODULES: { module: string; label: string; permissions: PermissionDef[] }[] = [
  { module: "dashboard", label: "Dashboard", permissions: [def("dashboard", "view", "View dashboard")] },
  {
    module: "lc",
    label: "LC management",
    permissions: [
      def("lc", "view", "View LCs"),
      def("lc", "create", "Create LCs"),
      def("lc", "update", "Edit LCs & cost items"),
      def("lc", "delete", "Delete LCs"),
      def("lc", "finalize", "Finalize landed cost"),
    ],
  },
  {
    module: "purchase",
    label: "Purchasing",
    permissions: [
      def("purchase", "view", "View purchase orders"),
      def("purchase", "create", "Create purchase orders"),
      def("purchase", "update", "Edit / cancel purchase orders"),
      def("purchase", "receive", "Receive goods"),
    ],
  },
  {
    module: "inventory",
    label: "Inventory",
    permissions: [
      def("inventory", "view", "View products & stock"),
      def("inventory", "create", "Create products"),
      def("inventory", "update", "Edit products"),
      def("inventory", "delete", "Delete products"),
      def("inventory", "adjust", "Stock adjustments"),
      def("inventory", "transfer", "Branch transfers"),
      def("inventory", "view_cost", "See cost prices"),
    ],
  },
  {
    module: "sales",
    label: "Sales & POS",
    permissions: [
      def("sales", "view", "View invoices"),
      def("sales", "create", "Create invoices & quotations"),
      def("sales", "cancel", "Cancel invoices / orders"),
      def("sales", "receipt", "Record money receipts"),
      def("sales", "return", "Request returns"),
      def("sales", "return_approve", "Approve returns"),
      def("sales", "override_credit", "Override credit limit"),
      def("sales", "discount", "Give discounts"),
      def("sales", "view_all", "See all salesmen's sales"),
    ],
  },
  {
    module: "delivery",
    label: "Delivery",
    permissions: [
      def("delivery", "view", "View challans"),
      def("delivery", "manage", "Update challans & delivery charges"),
    ],
  },
  {
    module: "customers",
    label: "Customers",
    permissions: [
      def("customers", "view", "View customers & ledger"),
      def("customers", "create", "Create customers"),
      def("customers", "update", "Edit customers & credit limits"),
      def("customers", "delete", "Delete customers"),
    ],
  },
  {
    module: "suppliers",
    label: "Suppliers",
    permissions: [
      def("suppliers", "view", "View suppliers & ledger"),
      def("suppliers", "create", "Create suppliers"),
      def("suppliers", "update", "Edit suppliers"),
      def("suppliers", "delete", "Delete suppliers"),
    ],
  },
  {
    module: "expenses",
    label: "Expenses",
    permissions: [
      def("expenses", "view", "View expenses"),
      def("expenses", "create", "Record expenses"),
      def("expenses", "update", "Edit expenses"),
      def("expenses", "delete", "Delete expenses"),
    ],
  },
  {
    module: "finance",
    label: "Finance",
    permissions: [
      def("finance", "view", "View P&L and payables"),
      def("finance", "cash_closing", "Daily cash closing"),
      def("finance", "supplier_payment", "Record supplier payments"),
    ],
  },
  {
    module: "reports",
    label: "Reports",
    permissions: [
      def("reports", "sales", "Sales reports"),
      def("reports", "stock", "Stock reports"),
      def("reports", "financial", "Financial reports"),
      def("reports", "export", "Export reports"),
    ],
  },
  {
    module: "org",
    label: "Organization",
    permissions: [
      def("org", "branches", "Manage branches"),
      def("org", "employees", "Manage employees"),
      def("org", "roles", "Manage roles & permissions"),
      def("org", "audit", "View audit log"),
    ],
  },
  {
    module: "settings",
    label: "Settings",
    permissions: [def("settings", "company", "Company profile"), def("settings", "billing", "Subscription & billing")],
  },
]

export const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) => m.permissions)
export const ALL_PERMISSION_KEYS = ALL_PERMISSIONS.map((p) => p.key)

const pick = (...prefixes: string[]) =>
  ALL_PERMISSION_KEYS.filter((k) => prefixes.some((p) => (p.endsWith(".") ? k.startsWith(p) : k === p)))

/** Default system roles seeded for every new company (AUTH-02, SRS §9). */
export const SYSTEM_ROLES: { key: string; name: string; description: string; permissions: string[]; allBranches: boolean }[] = [
  {
    key: "owner",
    name: "Company Owner",
    description: "Full access to everything in the company.",
    permissions: ALL_PERMISSION_KEYS,
    allBranches: true,
  },
  {
    key: "branch_manager",
    name: "Branch Manager",
    description: "Runs day-to-day operations of assigned branches.",
    permissions: pick(
      "dashboard.", "lc.view", "purchase.", "inventory.", "sales.", "delivery.", "customers.",
      "suppliers.view", "suppliers.create", "suppliers.update", "expenses.", "finance.view", "finance.cash_closing",
      "reports.sales", "reports.stock", "reports.export",
    ),
    allBranches: false,
  },
  {
    key: "sales_staff",
    name: "Sales Staff",
    description: "Counter staff creating invoices and receiving payments.",
    permissions: pick("dashboard.view", "inventory.view", "sales.view", "sales.create", "sales.receipt", "sales.return", "delivery.view", "customers.view", "customers.create", "reports.sales"),
    allBranches: false,
  },
  {
    key: "inventory_manager",
    name: "Inventory Manager",
    description: "Receives goods and manages stock.",
    permissions: pick("dashboard.view", "lc.view", "purchase.", "inventory.", "suppliers.view", "reports.stock"),
    allBranches: false,
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Expenses, cash closing, LC costing and financial reports.",
    permissions: pick(
      "dashboard.view", "lc.", "purchase.view", "inventory.view", "inventory.view_cost", "sales.view", "sales.view_all",
      "sales.receipt", "customers.view", "suppliers.view", "expenses.", "finance.", "reports.",
    ),
    allBranches: true,
  },
  {
    key: "delivery_coordinator",
    name: "Delivery Coordinator",
    description: "Challans, delivery status and LC delivery charges.",
    permissions: pick("dashboard.view", "lc.view", "sales.view", "delivery."),
    allBranches: false,
  },
]

export type PlanFeatures = {
  lc: boolean
  purchase: boolean
  crm: boolean
  advancedReports: boolean
  multiBranchTransfer: boolean
  export: boolean
  prioritySupport: boolean
}

export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  lc: "LC & landed-cost engine",
  purchase: "Purchase orders & goods receipt",
  crm: "Customer credit & ledgers",
  advancedReports: "Advanced reports & P&L",
  multiBranchTransfer: "Inter-branch stock transfer",
  export: "PDF / Excel export",
  prioritySupport: "Priority support",
}
