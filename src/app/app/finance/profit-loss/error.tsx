"use client"

import { FinanceError } from "@/components/finance/page-states"

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <FinanceError reset={reset} back={{ href: "/app", label: "Dashboard" }} />
}
