"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { ChevronRight, Lock } from "lucide-react"
import { toast } from "sonner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { LogoMark } from "@/components/brand/logo"
import { useI18n } from "@/components/i18n/i18n-provider"
import { NAV_GROUP_KEYS, NAV_ITEM_KEYS, NAV_SUB_KEYS, bestMatch } from "@/lib/i18n/nav"
import { canClient, useApp } from "./app-context"
import { NAV, type NavLeaf } from "./nav-config"

const ALL_HREFS = NAV.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]))

export function AppSidebar() {
  const ctx = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const { t, tx } = useI18n()
  const { isMobile, setOpenMobile, state } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  const visible = (l: NavLeaf) => canClient(ctx, l.perm)
  const locked = (l: NavLeaf) => !!l.feature && !ctx.plan.features[l.feature]
  /** The single nav href that best owns the current route (longest prefix), so nested pages keep their entry lit. */
  const current = useMemo(() => bestMatch(pathname, ALL_HREFS), [pathname])
  const activeParent = NAV.flatMap((g) => g.items).find((i) => i.children?.some((c) => c.href === current) || i.href === current)?.href

  // Expand the group that owns the current route whenever the route changes (keeps manual toggles otherwise).
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [prevPath, setPrevPath] = useState(pathname)
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    if (activeParent && !open[activeParent]) setOpen((o) => ({ ...o, [activeParent]: true }))
  }

  const closeMobile = () => isMobile && setOpenMobile(false)
  const showLocked = (title: string) =>
    toast(t("sidebar.locked", { feature: title, plan: ctx.plan.name }), {
      description: t("sidebar.lockedText"),
      icon: <Lock className="size-4" />,
      action: {
        label: t("sidebar.upgrade"),
        onClick: () => {
          closeMobile()
          router.push("/app/settings/billing")
        },
      },
    })

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/app" onClick={closeMobile} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          {ctx.company.logoUrl ? (
            <Image src={ctx.company.logoUrl} alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
          ) : (
            <LogoMark className="size-7 shrink-0" />
          )}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">{ctx.company.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{t("sidebar.plan", { plan: ctx.plan.name })}</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => {
          const items = group.items.filter(visible)
          if (!items.length) return null
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{tx(NAV_GROUP_KEYS[group.label], group.label)}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => {
                  const title = tx(NAV_ITEM_KEYS[item.href], item.title)
                  const children = item.children?.filter(visible)
                  const active = item.href === current || !!children?.some((c) => c.href === current)
                  const isLocked = locked(item)

                  if (isLocked)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          tooltip={title}
                          isActive={active}
                          onClick={() => showLocked(title)}
                          aria-label={`${title} — ${t("sidebar.lockedBadge")}`}
                          className="text-sidebar-foreground/70"
                        >
                          <item.icon />
                          <span>{title}</span>
                          <Lock className="ml-auto size-3 opacity-60" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )

                  if (!children?.length || collapsed)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={title}>
                          <Link href={item.href} onClick={closeMobile}>
                            <item.icon />
                            <span>{title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )

                  return (
                    <Collapsible
                      key={item.href}
                      asChild
                      open={open[item.href] ?? active}
                      onOpenChange={(v) => setOpen((o) => ({ ...o, [item.href]: v }))}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={title} isActive={active && !(open[item.href] ?? active)}>
                            <item.icon />
                            <span>{title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {children.map((c) => {
                              const sub = tx(NAV_SUB_KEYS[c.href], c.title)
                              return (
                                <SidebarMenuSubItem key={c.href}>
                                  {locked(c) ? (
                                    <SidebarMenuSubButton asChild>
                                      <button type="button" onClick={() => showLocked(sub)} className="w-full text-sidebar-foreground/70">
                                        <span>{sub}</span>
                                        <Lock className="ml-auto size-3 opacity-60" />
                                      </button>
                                    </SidebarMenuSubButton>
                                  ) : (
                                    <SidebarMenuSubButton asChild isActive={c.href === current}>
                                      <Link href={c.href} onClick={closeMobile} aria-current={c.href === current ? "page" : undefined}>
                                        <span>{sub}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  )}
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        <p className="px-2 py-1 text-[11px] text-muted-foreground">TexonPOS v1.0</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
