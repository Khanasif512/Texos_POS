"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Toolbar above a printable document. `onPrinted` (optional) is called once per print so the page
 * can record print status (SLS-08). `auto` triggers the print dialog on load.
 */
export function PrintToolbar({ title, onPrinted, auto }: { title: string; onPrinted?: () => void | Promise<void>; auto?: boolean }) {
  const router = useRouter()
  const done = useRef(false)
  const print = async () => {
    window.print()
    await onPrinted?.()
  }
  useEffect(() => {
    if (auto && !done.current) {
      done.current = true
      setTimeout(print, 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])
  return (
    <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft /> Back
      </Button>
      <span className="text-sm font-medium">{title}</span>
      <Button size="sm" className="ml-auto" onClick={print}>
        <Printer /> Print / Save PDF
      </Button>
    </div>
  )
}

/** A4 sheet wrapper. */
export function PrintSheet({ children, landscape = false }: { children: React.ReactNode; landscape?: boolean }) {
  return (
    <div
      className={`mx-auto my-6 w-full ${landscape ? "max-w-[297mm]" : "max-w-[210mm]"} bg-white p-[12mm] text-[13px] text-neutral-900 shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none`}
    >
      {children}
    </div>
  )
}
