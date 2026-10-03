import { Construction } from "lucide-react"
import { PageBody, PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { requireTenant } from "@/server/auth/context"

const PHASE: Record<string, { title: string; phase: number }> = {
  pos: { title: "Point of sale", phase: 4 },
  lc: { title: "LC management", phase: 3 },
  purchases: { title: "Purchasing", phase: 3 },
  products: { title: "Products", phase: 2 },
  inventory: { title: "Inventory", phase: 3 },
  suppliers: { title: "Suppliers", phase: 2 },
  customers: { title: "Customers", phase: 2 },
  sales: { title: "Sales", phase: 4 },
  expenses: { title: "Expenses", phase: 5 },
  finance: { title: "Finance", phase: 5 },
  reports: { title: "Reports", phase: 6 },
  org: { title: "Organization", phase: 1 },
  settings: { title: "Settings", phase: 7 },
}

/** Placeholder for modules scheduled in later phases (docs/PLAN.md). */
export default async function UpcomingModulePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  await requireTenant(`/app/${slug.join("/")}`)
  const info = PHASE[slug[0]] ?? { title: "Page", phase: 8 }
  return (
    <PageBody>
      <PageHeader title={info.title} />
      <EmptyState
        icon={Construction}
        title="This module is on its way"
        text={`${info.title} is scheduled for implementation phase ${info.phase}. Everything you set up now will be available to it.`}
      />
    </PageBody>
  )
}
