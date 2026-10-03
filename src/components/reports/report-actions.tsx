"use client"

import { useState } from "react"
import Link from "next/link"
import { FileSpreadsheet, Loader2, Lock, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Props = { slug: string; query: string; canExport: boolean; exportLocked: boolean; planName: string }

async function download(url: string, retry = true): Promise<void> {
  const res = await fetch(url)
  const type = res.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const json = await res.json().catch(() => null)
    if (json?.error?.code === "TOKEN_EXPIRED" && retry) {
      const ok = await fetch("/api/v1/auth/refresh", { method: "POST" }).then((r) => r.ok)
      if (ok) return download(url, false)
    }
    throw new Error(json?.error?.message ?? "Export failed")
  }
  if (!res.ok) throw new Error("Export failed")
  const blob = await res.blob()
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "report.xlsx"
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/** Excel download and printable (Save as PDF) view of the current report with its filters. */
export function ReportActions({ slug, query, canExport, exportLocked, planName }: Props) {
  const [busy, setBusy] = useState(false)
  const qs = query ? `?${query}` : ""

  if (!canExport) return null
  if (exportLocked)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" asChild>
            <Link href="/app/settings/billing">
              <Lock /> Export
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>PDF / Excel export is not included in the {planName} plan</TooltipContent>
      </Tooltip>
    )

  const excel = async () => {
    setBusy(true)
    try {
      await download(`/api/v1/reports/${slug}/export${qs}${qs ? "&" : "?"}format=xlsx`)
      toast.success("Excel file downloaded")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={excel} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Excel
      </Button>
      <Button variant="outline" asChild>
        <a href={`/print/reports/${slug}${qs}`} target="_blank" rel="noopener">
          <Printer /> Print / PDF
        </a>
      </Button>
    </>
  )
}
