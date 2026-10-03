import { ArrowDownRight, ArrowUpRight, Boxes, FileText, LayoutDashboard, Receipt, Ship, Users } from "lucide-react"

const bars = [42, 58, 49, 66, 72, 61, 80, 74, 88, 69, 92, 84]

/** Static illustration of the app dashboard used on marketing pages. */
export function ProductPreview() {
  return (
    <div className="relative rounded-2xl border bg-card p-1.5 shadow-2xl shadow-primary/10 ring-1 ring-foreground/5">
      <div className="flex items-center gap-1.5 border-b px-3 py-2.5">
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <div className="mx-auto hidden rounded-md bg-muted px-16 py-1 text-[10px] text-muted-foreground sm:block">
          app.texonpos.com/dashboard
        </div>
      </div>
      <div className="flex">
        <aside className="hidden w-40 shrink-0 space-y-1 border-r p-3 text-[11px] lg:block">
          {[
            [LayoutDashboard, "Dashboard", true],
            [Ship, "LC Management"],
            [Boxes, "Inventory"],
            [Receipt, "Sales (POS)"],
            [Users, "Customers"],
            [FileText, "Reports"],
          ].map(([Icon, label, active]) => {
            const I = Icon as typeof Ship
            return (
              <div
                key={label as string}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"}`}
              >
                <I className="size-3.5" />
                {label as string}
              </div>
            )
          })}
        </aside>
        <div className="min-w-0 flex-1 space-y-3 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Today's sales", "৳ 4,82,350", "+12.4%", true],
              ["Gross profit", "৳ 1,06,120", "+8.1%", true],
              ["Receivables", "৳ 18,40,900", "-3.2%", false],
              ["Stock value", "৳ 2.14 Cr", "+1.9%", true],
            ].map(([k, v, d, up]) => (
              <div key={k as string} className="rounded-lg border bg-background p-2.5">
                <p className="text-[10px] text-muted-foreground">{k}</p>
                <p className="num mt-1 text-sm font-semibold">{v}</p>
                <p className={`mt-0.5 flex items-center gap-0.5 text-[10px] ${up ? "text-success" : "text-destructive"}`}>
                  {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {d}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <div className="rounded-lg border bg-background p-3 sm:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium">Sales vs. cost — last 12 months</p>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">All branches</span>
              </div>
              <div className="mt-3 flex h-28 items-end gap-1.5">
                {bars.map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col justify-end gap-0.5">
                    <div className="rounded-sm bg-primary/85" style={{ height: `${h}%` }} />
                    <div className="rounded-sm bg-brand-teal/70" style={{ height: `${h * 0.28}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border bg-background p-3 sm:col-span-2">
              <p className="text-[11px] font-medium">LC pipeline</p>
              <div className="mt-2 space-y-2">
                {[
                  ["LC-2026-0091", "Cost finalized", "bg-success/15 text-success"],
                  ["LC-2026-0094", "In transit", "bg-info/15 text-info"],
                  ["LC-2026-0097", "Opened", "bg-warning/20 text-warning"],
                ].map(([n, s, c]) => (
                  <div key={n} className="flex items-center justify-between rounded-md border px-2 py-1.5">
                    <span className="num text-[10px] font-medium">{n}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${c}`}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
