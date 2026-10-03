import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  Check,
  CreditCard,
  FileSpreadsheet,
  Keyboard,
  Receipt,
  ShieldCheck,
  Ship,
  Truck,
  Users,
} from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { ProductPreview } from "@/components/marketing/product-preview"
import { CtaBand, SectionHeading } from "@/components/marketing/section"

const WORKFLOW = [
  { icon: Users, title: "Supplier", text: "Keep every overseas supplier, currency and bank detail in one place." },
  { icon: Ship, title: "Open LC", text: "Record LC number, bank, value in RMB/USD and expected arrival." },
  { icon: Calculator, title: "Finalize cost", text: "Enter freight, port, CNF, duty — get per-unit landed cost instantly." },
  { icon: Boxes, title: "Receive stock", text: "Goods land in the right branch, tracked by LC batch with FIFO costing." },
  { icon: Receipt, title: "Sell", text: "Cash or credit invoices, challans and money receipts at the counter." },
  { icon: BarChart3, title: "Know your profit", text: "Real margins per item, per invoice, per branch — every day." },
]

const FEATURES = [
  { icon: Calculator, title: "Automatic landed cost", text: "Distribute LC charges by weight or by piece. See exactly how every taka was allocated." },
  { icon: Building2, title: "Multi-branch inventory", text: "Showrooms and warehouses with their own stock, invoices and cash — rolled up company-wide." },
  { icon: Keyboard, title: "Fast counter POS", text: "Keyboard-first billing with barcode-ready search. A cash sale takes seconds, not minutes." },
  { icon: CreditCard, title: "Credit & customer ledgers", text: "Credit limits, opening balances, advances and money receipts with a live outstanding view." },
  { icon: Truck, title: "Challans & delivery", text: "Print delivery challans without prices and track delivery charges against each LC." },
  { icon: FileSpreadsheet, title: "16+ business reports", text: "P&L, daily cash closing, salesman-wise sales, top items — export to PDF or Excel." },
  { icon: ShieldCheck, title: "Roles & audit trail", text: "Granular permissions per branch, plus a full history of who changed what and when." },
  { icon: BarChart3, title: "Daily cash closing", text: "Opening cash, sales, receipts and expenses reconciled per branch, every evening." },
]

const FAQ = [
  {
    q: "Who is TexonPOS built for?",
    a: "Businesses that import goods — typically through Letters of Credit — and sell them through one or more showrooms: aluminium, glass, tiles, sanitary, hardware, home decor, electronics and similar trades.",
  },
  {
    q: "How is landed cost calculated?",
    a: "You record the product lines with their foreign price, the exchange rate, and every charge on the LC (opening cost, freight, port, CNF, transport, unloading, delivery, customs duty and others). TexonPOS spreads the charges across the units by weight or by quantity, and keeps the full calculation so it can be audited later.",
  },
  {
    q: "Can I use it in more than one branch?",
    a: "Yes. Each branch has its own stock, invoice numbering and cash, while owners see consolidated reports. Staff only see the branches they are assigned to.",
  },
  {
    q: "Is my data separate from other companies?",
    a: "Every company has a fully isolated workspace. Access is checked on the server for every request, and sensitive financial changes are written to an audit log.",
  },
  {
    q: "What happens after the free trial?",
    a: "Pick a plan that fits your branch and team size. Your data stays intact — if you do not subscribe, the workspace simply becomes read-only until you do.",
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Link
              href="/features#lc"
              className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur hover:text-foreground"
            >
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">New</span>
              LC landed-cost engine with full audit trail
              <ArrowRight className="size-3" />
            </Link>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              From letter of credit to the last sale.{" "}
              <span className="bg-gradient-to-r from-primary to-brand-teal bg-clip-text text-transparent">One system.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-balance">
              TexonPOS is the cloud POS and inventory platform for importers. Calculate true landed cost, run every branch, sell on cash or
              credit, and see real profit — without a single spreadsheet.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 px-6 text-base">
                <Link href="/signup">
                  Start 14-day free trial <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6 text-base">
                <Link href="/contact">Book a demo</Link>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No credit card required", "Set up in 2 minutes", "Bangla-friendly formats"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-y bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="Built around the way importers actually work"
            text="Every step from choosing a supplier in China to closing the day's cash in Dhaka is a first-class part of the product."
          />
          <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW.map((s, i) => (
              <li key={s.title} className="group relative rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <span className="num text-3xl font-semibold text-foreground/10">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Landed cost */}
      <section id="lc" className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold text-primary">Landed cost, solved</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Know the real cost of every piece you sell</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              An LC carries a dozen charges on top of the supplier price. TexonPOS converts the foreign price at your exchange rate, then
              spreads freight, port, CNF, duty and the rest across every unit — by weight or by quantity, your choice per shipment.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Every charge stored separately and auditable",
                "Compare weight vs. quantity basis before you finalize",
                "Corrections create a new versioned snapshot — history is never overwritten",
                "FIFO batch costing means each sale carries its true cost",
              ].map((t) => (
                <li key={t} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="size-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">LC-2026-0091 · Aluminium profiles</p>
                <p className="mt-0.5 font-semibold">Landed cost — weight basis</p>
              </div>
              <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">Finalized</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ["Exchange rate", "16.50 BDT/RMB"],
                ["Extra charges", "৳ 1,50,000"],
                ["Total weight", "1,800 kg"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-muted/60 px-2 py-3">
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                  <p className="num mt-1 text-sm font-semibold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Base</th>
                    <th className="px-3 py-2 text-right font-medium">+ Charges</th>
                    <th className="px-3 py-2 text-right font-medium">Landed</th>
                  </tr>
                </thead>
                <tbody className="num">
                  <tr className="border-t">
                    <td className="px-3 py-2.5">Profile Type-1 <span className="text-xs text-muted-foreground">× 2,000</span></td>
                    <td className="px-3 py-2.5 text-right">132.00</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">41.67</td>
                    <td className="px-3 py-2.5 text-right font-semibold">৳ 173.67</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2.5">Profile Type-2 <span className="text-xs text-muted-foreground">× 1,000</span></td>
                    <td className="px-3 py-2.5 text-right">198.00</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">66.67</td>
                    <td className="px-3 py-2.5 text-right font-semibold">৳ 264.67</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["LC opening 15,000", "Freight 40,000", "Port 10,000", "CNF 8,000", "Transport 12,000", "Unloading 5,000", "Duty 60,000"].map(
                (c) => (
                  <span key={c} className="num rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
                    {c}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Everything in one place"
            title="All the tools to run an import business"
            text="Purchasing, stock, sales, credit, expenses and reporting — designed together, so numbers always agree."
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6">
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline" className="h-10 px-5">
              <Link href="/features">
                Explore all features <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-primary">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Questions, answered</h2>
            <p className="mt-4 text-muted-foreground">
              Can&apos;t find what you need?{" "}
              <Link href="/contact" className="font-medium text-primary hover:underline">
                Talk to our team
              </Link>
              .
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((f, i) => (
              <AccordionItem key={i} value={`q${i}`}>
                <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <CtaBand />
    </>
  )
}
