import { StatusBadge, type Tone } from "@/components/shared/status-badge"
import { PAYMENT_METHOD_LABEL } from "@/lib/validation/sales-after"

export const methodLabel = (m: string) => PAYMENT_METHOD_LABEL[m as keyof typeof PAYMENT_METHOD_LABEL] ?? m

export const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))

export function ReceiptStatusBadge({ cancelled, isAdvance, unallocated }: { cancelled: boolean; isAdvance?: boolean; unallocated?: number }) {
  if (cancelled) return <StatusBadge tone="danger">Cancelled</StatusBadge>
  if (isAdvance && (unallocated ?? 0) > 0) return <StatusBadge tone="info">Advance</StatusBadge>
  return <StatusBadge tone="success">Received</StatusBadge>
}

const RETURN_TONE: Record<string, Tone> = { pending: "warning", approved: "success", rejected: "danger" }
export function ReturnStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={RETURN_TONE[status] ?? "neutral"} className="capitalize">
      {status === "pending" ? "Pending approval" : status}
    </StatusBadge>
  )
}

export function RefundModeBadge({ mode }: { mode: string }) {
  return <StatusBadge tone={mode === "cash" ? "neutral" : "primary"}>{mode === "cash" ? "Cash refund" : "Credit note"}</StatusBadge>
}

const ORDER_TONE: Record<string, Tone> = { open: "info", converted: "success", cancelled: "neutral" }
export function OrderStatusBadge({ status, expired }: { status: string; expired?: boolean }) {
  if (expired) return <StatusBadge tone="warning">Expired</StatusBadge>
  return (
    <StatusBadge tone={ORDER_TONE[status] ?? "neutral"} className="capitalize">
      {status}
    </StatusBadge>
  )
}

export function OrderTypeBadge({ type }: { type: string }) {
  return <StatusBadge tone={type === "order" ? "primary" : "neutral"}>{type === "order" ? "Sales order" : "Quotation"}</StatusBadge>
}
