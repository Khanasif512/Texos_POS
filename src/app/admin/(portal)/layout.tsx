import type { Metadata } from "next"
import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdmin } from "@/server/auth/admin-context"

export const metadata: Metadata = { title: { default: "Platform", template: "%s · TexonPOS Platform" } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  return <AdminShell admin={{ name: admin.name, email: admin.email }}>{children}</AdminShell>
}
