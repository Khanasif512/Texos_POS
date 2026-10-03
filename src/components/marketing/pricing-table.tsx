"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FEATURE_LABELS, type PlanFeatures } from "@/lib/permissions"
import { integer } from "@/lib/format"
import { cn } from "@/lib/utils"

export type PricingPlan = {
  code: string
  name: string
  tagline: string
  priceMonthly: number
  priceYearly: number
  maxBranches: number
  maxEmployees: number
  maxProducts: number | null
  features: PlanFeatures
  highlighted: boolean
}

export function PricingTable({ plans }: { plans: PricingPlan[] }) {
  const [yearly, setYearly] = useState(false)
  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border bg-muted/50 p-1 text-sm">
          {[
            [false, "Monthly"],
            [true, "Yearly · 2 months free"],
          ].map(([v, label]) => (
            <button
              key={String(v)}
              onClick={() => setYearly(v as boolean)}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium transition-colors",
                yearly === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {plans.map((p) => {
          const price = yearly ? p.priceYearly : p.priceMonthly
          return (
            <div
              key={p.code}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-8",
                p.highlighted && "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary",
              )}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="num text-4xl font-semibold tracking-tight">৳{integer(price)}</span>
                <span className="text-sm text-muted-foreground">/{yearly ? "year" : "month"}</span>
              </p>
              <Button asChild className="mt-6 h-10" variant={p.highlighted ? "default" : "outline"}>
                <Link href={`/signup?plan=${p.code}`}>Start free trial</Link>
              </Button>
              <ul className="mt-8 space-y-3 text-sm">
                <Row ok text={`${p.maxBranches} branch${p.maxBranches > 1 ? "es" : ""}`} />
                <Row ok text={`${p.maxEmployees} team members`} />
                <Row ok text={p.maxProducts ? `${integer(p.maxProducts)} products` : "Unlimited products"} />
                <Row ok text="Cash & credit POS, challans, receipts" />
                {(Object.keys(FEATURE_LABELS) as (keyof PlanFeatures)[]).map((k) => (
                  <Row key={k} ok={!!p.features?.[k]} text={FEATURE_LABELS[k]} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Row({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={cn("flex items-start gap-2.5", !ok && "text-muted-foreground/70")}>
      {ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : <Minus className="mt-0.5 size-4 shrink-0" />}
      {text}
    </li>
  )
}
