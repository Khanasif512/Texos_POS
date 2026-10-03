"use client"

import Link from "next/link"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { PageBody } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/** Route-level loading skeleton for finance / expense pages. */
export function FinanceSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <PageBody>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {kpis > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: kpis }, (_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))}
        </div>
      )}
      <Skeleton className="h-[420px] rounded-xl" />
    </PageBody>
  )
}

/** Route-level error state with retry. */
export function FinanceError({ reset, back }: { reset: () => void; back?: { href: string; label: string } }) {
  return (
    <PageBody>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <h3 className="mt-4 font-semibold">This page could not be loaded</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">Something went wrong while loading the figures. Please try again.</p>
        <div className="mt-6 flex gap-2">
          <Button onClick={reset}>
            <RotateCcw /> Try again
          </Button>
          {back && (
            <Button variant="outline" asChild>
              <Link href={back.href}>{back.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </PageBody>
  )
}
