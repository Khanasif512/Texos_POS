"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Bell, Building, Check, ChevronsUpDown, LogOut, Moon, Settings, Sun, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useT } from "@/components/i18n/i18n-provider"
import { LanguageMenuItems } from "@/components/i18n/language-switch"
import { api, errorMessage } from "@/lib/api-client"
import { initials } from "@/lib/format"
import { useApp } from "./app-context"
import { CommandPalette } from "./command-palette"
import { NotificationsBell } from "./notifications-bell"

export function AppTopbar() {
  const ctx = useApp()
  const router = useRouter()
  const t = useT()
  const { resolvedTheme, setTheme } = useTheme()
  const active = ctx.branches.find((b) => b.id === ctx.activeBranchId)

  const switchBranch = async (branchId: string) => {
    try {
      await api.post("/api/v1/auth/branch", { branchId })
      router.refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const logout = async () => {
    await api.post("/api/v1/auth/logout").catch(() => {})
    router.replace("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b bg-background/85 px-3 backdrop-blur-md sm:gap-2 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 max-w-[150px] min-w-0 gap-2 px-2 sm:max-w-[220px] sm:px-2.5">
            <Building className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{active?.name ?? t("topbar.noBranch")}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t("topbar.switchBranch")}</DropdownMenuLabel>
          {ctx.branches.map((b) => (
            <DropdownMenuItem key={b.id} onSelect={() => switchBranch(b.id)} className="gap-2">
              <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">{b.code}</span>
              <span className="flex-1 truncate">{b.name}</span>
              {b.id === ctx.activeBranchId && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1">
        <CommandPalette />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("topbar.toggleTheme")}
          className="hidden sm:inline-flex"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
        <NotificationsBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ml-0.5 h-9 gap-2 px-1.5">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">{initials(ctx.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate text-sm font-medium md:block">{ctx.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-medium">{ctx.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{ctx.email}</p>
              <p className="mt-1 text-[11px] font-normal text-muted-foreground">{ctx.roleName}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/profile">
                <UserRound /> {t("topbar.myProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings/notifications">
                <Bell /> {t("topbar.notificationSettings")}
              </Link>
            </DropdownMenuItem>
            {ctx.isOwner && (
              <DropdownMenuItem asChild>
                <Link href="/app/settings/company">
                  <Settings /> {t("topbar.companySettings")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="sm:hidden" onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="dark:hidden" />
              <Moon className="hidden dark:block" /> {t("topbar.toggleTheme")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <LanguageMenuItems />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} variant="destructive">
              <LogOut /> {t("topbar.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
