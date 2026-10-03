import type { Metadata } from "next"
import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  History,
  Keyboard,
  PackageCheck,
  Printer,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Ship,
  Truck,
  Users,
  Wallet,
} from "lucide-react"
import { CtaBand, PageHero } from "@/components/marketing/section"

export const metadata: Metadata = { title: "Features" }

const GROUPS = [
  {
    id: "lc",
    title: "LC & import costing",
    text: "The heart of TexonPOS. Turn a letter of credit and its charges into an exact, auditable cost per unit.",
    items: [
      { icon: Ship, title: "LC lifecycle", text: "Draft → opened → in transit → received → cost finalized → closed, with dates and documents." },
      { icon: Calculator, title: "Cost distribution engine", text: "Spread extra charges by weight or by piece and compare both before finalizing." },
      { icon: History, title: "Versioned snapshots", text: "Every recalculation is stored with a reason and timestamp. Sold stock keeps its original cost." },
      { icon: Truck, title: "LC delivery charges", text: "Delivery costs entered against an LC number flow straight into that LC's costing." },
    ],
  },
  {
    id: "inventory",
    title: "Purchasing & inventory",
    text: "Know what you have, where it is, and what it really cost.",
    items: [
      { icon: ClipboardList, title: "Purchase orders", text: "LC-based and local purchases, with partial receipts and cancellation of the remainder." },
      { icon: PackageCheck, title: "Goods receipt", text: "Receive into any branch at landed cost. Each receipt becomes a traceable batch." },
      { icon: Boxes, title: "Variations & batches", text: "Sizes, thicknesses and finishes as variations, each with its own price, SKU and stock." },
      { icon: Building2, title: "Branch-wise stock", text: "Transfers between branches, adjustments with reason codes and low-stock alerts." },
    ],
  },
  {
    id: "pos",
    title: "Sales & point of sale",
    text: "A counter screen your staff will actually enjoy using.",
    items: [
      { icon: Keyboard, title: "Keyboard-first POS", text: "Search by name, SKU or barcode. Complete a cash sale without touching the mouse." },
      { icon: Receipt, title: "Cash & credit invoices", text: "Credit limits are checked at the counter, with manager override when needed." },
      { icon: Printer, title: "Challans & print tracking", text: "Delivery challans without prices, and a record of every print and reprint." },
      { icon: RotateCcw, title: "Returns & credit notes", text: "Returns go through approval, restock automatically and adjust the customer ledger." },
    ],
  },
  {
    id: "finance",
    title: "Customers, cash & finance",
    text: "Receivables, payables and profit you can trust every single day.",
    items: [
      { icon: Users, title: "Customer ledgers", text: "Opening balances, advances, money receipts and a running outstanding for every customer." },
      { icon: CreditCard, title: "Supplier payables", text: "What you owe each supplier, derived from LCs, purchases and recorded payments." },
      { icon: Wallet, title: "Expenses & cash closing", text: "Daily expenses per branch and an evening cash closing reconciled to the counted cash." },
      { icon: BarChart3, title: "Profit & loss", text: "Revenue minus FIFO cost minus expenses — by day, month and branch." },
    ],
  },
  {
    id: "control",
    title: "Control & reporting",
    text: "Owners see everything. Staff see exactly what they need.",
    items: [
      { icon: ShieldCheck, title: "Roles & permissions", text: "Six ready-made roles plus your own custom ones, scoped to the branches you choose." },
      { icon: History, title: "Audit log", text: "Who changed an LC, a price or a credit limit — with before and after values." },
      { icon: FileSpreadsheet, title: "16+ reports", text: "Sales, purchase, stock, returns, delivery, top items, customer and salesman reports." },
      { icon: Printer, title: "PDF & Excel export", text: "Every report filters by date range and branch, and exports in one click." },
    ],
  },
]

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything an import business needs, nothing it doesn't"
        text="TexonPOS covers the full journey — supplier, LC, shipment, stock, sale, cash and profit — in one connected workspace."
      />
      <div className="mx-auto max-w-7xl space-y-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        {GROUPS.map((g) => (
          <section key={g.id} id={g.id} className="grid scroll-mt-24 gap-10 lg:grid-cols-[1fr_2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="text-2xl font-semibold tracking-tight">{g.title}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{g.text}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.items.map((f) => (
                <div key={f.title} className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <CtaBand />
    </>
  )
}
