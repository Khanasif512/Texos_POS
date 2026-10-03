import type { PlanFeatures } from "./permissions"

/** Default plan catalog (seeded into `plans`; Super Admin can edit later). Prices in BDT. */
export const DEFAULT_PLANS: {
  code: string
  name: string
  tagline: string
  priceMonthly: number
  priceYearly: number
  maxBranches: number
  maxEmployees: number
  maxProducts: number | null
  features: PlanFeatures
  isDefaultTrial?: boolean
  sortOrder: number
}[] = [
  {
    code: "starter",
    name: "Starter",
    tagline: "For a single shop getting off spreadsheets.",
    priceMonthly: 1500,
    priceYearly: 15000,
    maxBranches: 1,
    maxEmployees: 5,
    maxProducts: 2000,
    features: { lc: false, purchase: true, crm: true, advancedReports: false, multiBranchTransfer: false, export: true, prioritySupport: false },
    sortOrder: 1,
  },
  {
    code: "growth",
    name: "Growth",
    tagline: "Importers running LCs across a few branches.",
    priceMonthly: 3500,
    priceYearly: 35000,
    maxBranches: 3,
    maxEmployees: 20,
    maxProducts: 20000,
    features: { lc: true, purchase: true, crm: true, advancedReports: true, multiBranchTransfer: true, export: true, prioritySupport: false },
    isDefaultTrial: true,
    sortOrder: 2,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    tagline: "Multi-branch distributors with large teams.",
    priceMonthly: 8000,
    priceYearly: 80000,
    maxBranches: 25,
    maxEmployees: 200,
    maxProducts: null,
    features: { lc: true, purchase: true, crm: true, advancedReports: true, multiBranchTransfer: true, export: true, prioritySupport: true },
    sortOrder: 3,
  },
]
