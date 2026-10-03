"use client"

import { RouteError } from "@/components/sales-after/page-states"

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <RouteError reset={reset} back={{ href: "/app/sales/orders", label: "Quotations & orders" }} />
}
