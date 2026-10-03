import type { Metadata } from "next"
import { cookies } from "next/headers"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppContextProvider } from "@/components/app/app-context"
import { AppSidebar } from "@/components/app/app-sidebar"
import { AppTopbar } from "@/components/app/app-topbar"
import { AppBanners } from "@/components/app/app-banners"
import { publicContext, requireTenant } from "@/server/auth/context"

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · TexonPOS" } }

export default async function TenantAppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenant("/app")
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  return (
    <AppContextProvider value={publicContext(ctx)}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppBanners />
          <AppTopbar />
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AppContextProvider>
  )
}
