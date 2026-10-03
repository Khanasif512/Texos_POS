"use client"

import { useRouter } from "next/navigation"
import { PrintToolbar } from "@/components/shared/print-toolbar"
import { api } from "@/lib/api-client"

/** Print toolbar that records each print (SLS-08 / DLV-02) via `endpoint`, then refreshes the reprint marker. */
export function DocPrintToolbar({ title, endpoint, auto }: { title: string; endpoint: string; auto?: boolean }) {
  const router = useRouter()
  return (
    <PrintToolbar
      title={title}
      auto={auto}
      onPrinted={async () => {
        await api.post(endpoint).catch(() => {})
        router.refresh()
      }}
    />
  )
}
