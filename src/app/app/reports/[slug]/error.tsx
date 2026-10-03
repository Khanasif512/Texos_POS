"use client"

import { ReportError } from "@/components/reports/report-states"

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <ReportError reset={reset} />
}
