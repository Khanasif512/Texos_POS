import Link from "next/link"
import { Check } from "lucide-react"
import { Logo } from "@/components/brand/logo"

const POINTS = [
  "Exact landed cost for every LC shipment",
  "Cash & credit POS with live credit limits",
  "Branch-wise stock with FIFO batch costing",
  "Daily cash closing and real profit reports",
]

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Texon ·{" "}
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-[oklch(0.22_0.07_272)] lg:block">
        <div className="bg-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="absolute -top-32 -right-32 size-[520px] rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-brand-teal/25 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center px-14 xl:px-20">
          <p className="text-sm font-medium text-white/60">TexonPOS for importers</p>
          <h2 className="mt-4 max-w-md text-4xl font-semibold tracking-tight text-white">
            Every LC, every branch, every taka — accounted for.
          </h2>
          <ul className="mt-10 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/85">
                <span className="flex size-6 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                  <Check className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-14 max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>LC-2026-0091 · weight basis</span>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">Finalized</span>
            </div>
            <div className="num mt-4 grid grid-cols-3 gap-3 text-white">
              <div>
                <p className="text-[11px] text-white/50">Base</p>
                <p className="font-semibold">৳132.00</p>
              </div>
              <div>
                <p className="text-[11px] text-white/50">Charges</p>
                <p className="font-semibold">+ ৳41.67</p>
              </div>
              <div>
                <p className="text-[11px] text-white/50">Landed</p>
                <p className="font-semibold text-emerald-300">৳173.67</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

export function AuthHeading({ title, text }: { title: string; text?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
    </div>
  )
}
