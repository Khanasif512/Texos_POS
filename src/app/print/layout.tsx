import { requireTenant } from "@/server/auth/context"

/** Bare layout for printable documents (invoice, challan, receipt, report) — no app shell. */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireTenant("/app")
  return <div className="min-h-screen bg-muted/40 print:bg-white">{children}</div>
}
