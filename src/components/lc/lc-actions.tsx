"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Loader2,
  Lock,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Printer,
  Ship,
  Trash2,
  Undo2,
  Unlock,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/shared/field"
import { useCan } from "@/components/app/app-context"
import { api, errorMessage } from "@/lib/api-client"
import { LC_STATUS_LABEL, type LcStatus } from "@/lib/validation/lc"

type Step = {
  to: LcStatus | "delete"
  title: string
  description: string
  confirm: string
  dateLabel?: string
  defaultDate?: string
  destructive?: boolean
}

const todayIso = () => new Date().toLocaleDateString("en-CA")

/** LC-10 workflow buttons + edit / print / delete for the LC detail header. */
export function LcActions({
  lc,
}: {
  lc: { id: string; lcNumber: string; status: LcStatus; openedDate: string | null; hasSnapshot: boolean; hasReceipts: boolean }
}) {
  const router = useRouter()
  const canUpdate = useCan("lc.update")
  const canDelete = useCan("lc.delete")
  const canFinalize = useCan("lc.finalize")
  const canReceive = useCan("purchase.receive")
  const [step, setStep] = useState<Step | null>(null)
  const [stepDate, setStepDate] = useState("")
  const [busy, setBusy] = useState(false)

  const open = (s: Step) => {
    setStepDate(s.defaultDate ?? "")
    setStep(s)
  }

  const run = async () => {
    if (!step) return
    setBusy(true)
    try {
      if (step.to === "delete") {
        await api.delete(`/api/v1/lc/${lc.id}`)
        toast.success(`LC ${lc.lcNumber} deleted`)
        router.push("/app/lc")
      } else {
        await api.post(`/api/v1/lc/${lc.id}/status`, { status: step.to, date: stepDate || null })
        toast.success(`${lc.lcNumber} is now ${LC_STATUS_LABEL[step.to].toLowerCase()}`)
        setStep(null)
      }
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const s = lc.status
  const forward: Record<string, Step | null> = {
    draft: {
      to: "opened",
      title: "Open this LC?",
      description: "Marks the LC as opened with the bank. Product lines stay editable until the goods are received.",
      confirm: "Mark opened",
      dateLabel: "Opened on",
      defaultDate: lc.openedDate ?? todayIso(),
    },
    opened: {
      to: "goods_in_transit",
      title: "Goods shipped?",
      description: "Marks the shipment as in transit to Bangladesh.",
      confirm: "Mark in transit",
    },
    goods_in_transit: {
      to: "received",
      title: "Goods arrived?",
      description:
        "Marks the LC as received. The supplier, LC value and product lines are then locked, and you can calculate and finalize the landed cost.",
      confirm: "Mark received",
      dateLabel: "Actual arrival date",
      defaultDate: todayIso(),
    },
    received: null,
    cost_finalized: canFinalize
      ? {
          to: "closed",
          title: "Close this LC?",
          description: "Closing locks costs and the exchange rate. You can reopen it later if a correction is needed.",
          confirm: "Close LC",
        }
      : null,
    closed: null,
  }
  const back: Record<string, Step | null> = {
    opened: { to: "draft", title: "Move back to draft?", description: "Use this if the LC was marked opened by mistake.", confirm: "Move to draft" },
    goods_in_transit: { to: "opened", title: "Move back to opened?", description: "Use this if the goods were marked in transit by mistake.", confirm: "Move to opened" },
    received:
      !lc.hasSnapshot && !lc.hasReceipts
        ? {
            to: "goods_in_transit",
            title: "Move back to in transit?",
            description: "Clears the actual arrival date and unlocks the product lines again.",
            confirm: "Move to in transit",
          }
        : null,
    closed: canFinalize
      ? { to: "cost_finalized", title: "Reopen this LC?", description: "Allows cost corrections and recalculation again (LC-07).", confirm: "Reopen" }
      : null,
  }
  const next = canUpdate ? forward[s] : null
  const prev = canUpdate ? back[s] : null
  const showReceive = canReceive && lc.hasSnapshot && (s === "received" || s === "cost_finalized")
  const NextIcon = s === "draft" ? Ship : s === "opened" ? ArrowRight : s === "goods_in_transit" ? PackageCheck : Lock

  return (
    <>
      <Button variant="outline" asChild>
        <Link href={`/print/lc/${lc.id}`} target="_blank">
          <Printer /> Print
        </Link>
      </Button>
      {canUpdate && (
        <Button variant="outline" asChild>
          <Link href={`/app/lc/${lc.id}/edit`}>
            <Pencil /> Edit
          </Link>
        </Button>
      )}
      {showReceive && (
        <Button variant={s === "received" ? "outline" : "default"} asChild>
          <Link href={`/app/purchases/receipts/new?lcId=${lc.id}`}>
            <PackageCheck /> Receive goods
          </Link>
        </Button>
      )}
      {s === "received" && canFinalize && (
        <Button asChild>
          <Link href={`/app/lc/${lc.id}?tab=landed`} scroll={false}>
            <Calculator /> Finalize cost
          </Link>
        </Button>
      )}
      {next && (
        <Button onClick={() => open(next)} variant={s === "cost_finalized" ? "outline" : "default"}>
          <NextIcon /> {next.confirm}
        </Button>
      )}
      {(prev || (canDelete && s === "draft")) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {prev && (
              <DropdownMenuItem onSelect={() => open(prev)}>
                {s === "closed" ? <Unlock /> : <Undo2 />} {prev.confirm}
              </DropdownMenuItem>
            )}
            {prev && canDelete && s === "draft" && <DropdownMenuSeparator />}
            {canDelete && s === "draft" && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  open({
                    to: "delete",
                    title: `Delete ${lc.lcNumber}?`,
                    description: "The draft LC and its product lines and cost items will be removed. This cannot be undone.",
                    confirm: "Delete LC",
                    destructive: true,
                  })
                }
              >
                <Trash2 /> Delete LC
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={!!step} onOpenChange={(o) => !o && !busy && setStep(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{step?.title}</DialogTitle>
            <DialogDescription>{step?.description}</DialogDescription>
          </DialogHeader>
          {step?.dateLabel && (
            <Field label={step.dateLabel} htmlFor="step-date" required>
              <Input id="step-date" type="date" value={stepDate} onChange={(e) => setStepDate(e.target.value)} max={todayIso()} />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={run}
              disabled={busy || (!!step?.dateLabel && !stepDate)}
              className={step?.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            >
              {busy ? <Loader2 className="animate-spin" /> : step?.destructive ? <Trash2 /> : <CheckCircle2 />}
              {step?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
