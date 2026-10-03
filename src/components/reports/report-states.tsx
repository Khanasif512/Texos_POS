"use client"

import Link from "next/link"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { PageBody } from "@/components/app/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function ReportSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <PageBody className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </PageBody>
  )
}

export function ReportError({ reset, message }: { reset: () => void; message?: string }) {
  return (
    <PageBody>
      <EmptyState
        icon={AlertTriangle}
        title="This report could not be generated"
        text={message ?? "Something went wrong while running the report. Try again, or narrow the date range."}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/app/reports">All reports</Link>
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
