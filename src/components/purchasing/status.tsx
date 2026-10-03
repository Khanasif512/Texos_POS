import { StatusBadge, type Tone } from "@/components/shared/status-badge"

const PO: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: "info", label: "Pending" },
  partially_received: { tone: "warning", label: "Partially received" },
  received: { tone: "success", label: "Received" },
  cancelled: { tone: "neutral", label: "Cancelled" },
}

export function PoStatusBadge({ status }: { status: string }) {
  const s = PO[status] ?? { tone: "neutral" as Tone, label: status }
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
}

const TRF: Record<string, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "In transit" },
  completed: { tone: "success", label: "Received" },
  cancelled: { tone: "neutral", label: "Cancelled" },
}

export function TransferStatusBadge({ status }: { status: string }) {
  const s = TRF[status] ?? { tone: "neutral" as Tone, label: status }
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
}

/** Plain-language labels for stock ledger movement types. */
export const TXN_LABEL: Record<string, string> = {
  opening: "Opening",
  purchase_in: "Purchase in",
  sale_out: "Sale",
  return_in: "Return in",
  cancel_in: "Cancelled sale",
  adjustment_in: "Adjustment +",
  adjustment_out: "Adjustment −",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
}

export const SOURCE_LABEL: Record<string, string> = {
  lc: "LC import",
  purchase: "Local purchase",
  opening: "Opening",
  transfer: "Transfer",
  return: "Return",
  adjustment: "Adjustment",
}
