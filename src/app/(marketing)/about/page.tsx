import type { Metadata } from "next"
import { Compass, HeartHandshake, Scale, Zap } from "lucide-react"
import { CtaBand, PageHero } from "@/components/marketing/section"

export const metadata: Metadata = { title: "About" }

const VALUES = [
  { icon: Scale, title: "Numbers you can defend", text: "Every cost, margin and balance can be traced back to the entries that produced it." },
  { icon: Zap, title: "Fast at the counter", text: "Software at a sales desk must be quicker than pen and paper — or nobody uses it." },
  { icon: HeartHandshake, title: "Built with traders", text: "Our first workflows came straight from an importer's handwritten process notes." },
  { icon: Compass, title: "Local by default", text: "Taka, lakh-crore grouping, LC banking practice and Bangladesh business hours." },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="We build software for the businesses that move real goods"
        text="TexonPOS is made by Texon, a software team in Dhaka working with importers and wholesalers who outgrew ledgers and spreadsheets."
      />
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="space-y-5 text-lg leading-relaxed text-muted-foreground">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Why we started</h2>
          <p>
            Ask an importer what a single aluminium profile really cost, and the answer usually lives in three spreadsheets, a bank
            statement and someone&apos;s memory. Freight, port charges, CNF, customs duty and transport are added late, split by hand,
            and often forgotten — so prices get set on guesswork.
          </p>
          <p>
            We built TexonPOS so that the moment an LC&apos;s charges are known, every unit has an exact cost — and every sale after that
            shows its true profit. Around that core we added everything a trading business needs to run each day.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-xl border bg-card p-6">
              <v.icon className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  )
}
