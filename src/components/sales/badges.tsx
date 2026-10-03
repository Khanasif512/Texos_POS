import { Printer } from "lucide-react"
import { StatusBadge, type Tone } from "@/components/shared/status-badge"
import { printStatusLabel } from "@/lib/validation/sales"

const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "success" },
  partially_returned: { label: "Part returned", tone: "warning" },
  returned: { label: "Returned", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const s = INVOICE_STATUS[status] ?? { label: status, tone: "neutral" as Tone }
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
}

export function InvoiceTypeBadge({ type }: { type: string }) {
  return <StatusBadge tone={type === "cash" ? "info" : "primary"}>{type === "cash" ? "Cash" : "Credit"}</StatusBadge>
}

export function ChallanStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={status === "delivered" ? "success" : "warning"}>{status === "delivered" ? "Delivered" : "Pending"}</StatusBadge>
}

/** SLS-08: Not printed / Printed / Reprinted ×N */
export function PrintStatusBadge({ count }: { count: number }) {
  return (
    <StatusBadge tone={count === 0 ? "neutral" : count === 1 ? "success" : "info"}>
      {count > 0 && <Printer className="size-3" />}
      {printStatusLabel(count)}
    </StatusBadge>
  )
}
