import type { Metadata } from "next"
import { CtaBand, PageHero } from "@/components/marketing/section"
import { PricingTable, type PricingPlan } from "@/components/marketing/pricing-table"
import { prisma } from "@/server/db"
import type { PlanFeatures } from "@/lib/permissions"

export const metadata: Metadata = { title: "Pricing" }
export const dynamic = "force-dynamic"

export default async function PricingPage() {
  const plans = await prisma.plan.findMany({ where: { isPublic: true, status: "active" }, orderBy: { sortOrder: "asc" } })
  const data: PricingPlan[] = plans.map((p) => ({
    code: p.code,
    name: p.name,
    tagline: p.tagline ?? "",
    priceMonthly: Number(p.priceMonthly),
    priceYearly: Number(p.priceYearly),
    maxBranches: p.maxBranches,
    maxEmployees: p.maxEmployees,
    maxProducts: p.maxProducts,
    features: p.features as PlanFeatures,
    highlighted: p.isDefaultTrial,
  }))

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple plans that grow with your business"
        text="Every plan starts with a 14-day free trial of Growth. No credit card, no setup fee, cancel anytime."
      />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <PricingTable plans={data} />
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Prices are in Bangladeshi Taka and exclude VAT. Need more than 25 branches?{" "}
          <a href="/contact" className="font-medium text-primary hover:underline">
            Contact sales
          </a>
          .
        </p>
      </div>
      <CtaBand />
    </>
  )
}
