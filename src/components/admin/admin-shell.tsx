"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Building2, CreditCard, Inbox, LayoutDashboard, LogOut, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoMark } from "@/components/brand/logo"
import { api } from "@/lib/api-client"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/plans", label: "Plans", icon: Package },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/messages", label: "Contact messages", icon: Inbox },
]

export function AdminShell({ admin, children }: { admin: { name: string; email: string }; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const logout = async () => {
    await api.post("/api/v1/admin/auth/logout").catch(() => {})
    router.replace("/admin/login")
  }
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-[oklch(0.2_0.035_270)] text-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LogoMark className="size-7" />
          <div>
            <p className="text-sm font-semibold leading-tight">TexonPOS</p>
            <p className="text-[11px] text-white/50">Platform admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white",
                  active && "bg-white/10 text-white",
                )}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{admin.name}</p>
          <p className="truncate text-xs text-white/50">{admin.email}</p>
          <Button variant="ghost" size="sm" onClick={logout} className="mt-3 w-full justify-start text-white/70 hover:bg-white/10 hover:text-white">
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
          <LogoMark className="size-6" />
          <span className="text-sm font-semibold">Platform admin</span>
          <nav className="ml-auto flex gap-1">
            {NAV.slice(0, 3).map((n) => (
              <Link key={n.href} href={n.href} className="rounded p-2 text-muted-foreground hover:bg-muted" aria-label={n.label}>
                <n.icon className="size-4" />
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  )
}
