"use client"

import Link from "next/link"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageBody } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"

/** loading.tsx body for list pages. */
export function ListSkeleton() {
  return (
    <PageBody>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex gap-2 border-b p-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </PageBody>
  )
}

/** error.tsx body for the after-sale routes. */
export function RouteError({ reset, back }: { reset: () => void; back: { href: string; label: string } }) {
  return (
    <PageBody>
      <EmptyState
        icon={AlertTriangle}
        title="This page could not be loaded"
        text="Something went wrong while loading the data. Try again, or go back to the list."
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={back.href}>{back.label}</Link>
            </Button>
            <Button onClick={reset}>
              <RotateCcw /> Try again
            </Button>
          </div>
        }
      />
    </PageBody>
  )
}
