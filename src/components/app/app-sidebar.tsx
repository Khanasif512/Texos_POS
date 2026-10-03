"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Lock } from "lucide-react"
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
} from "@/components/ui/sidebar"
import { LogoMark } from "@/components/brand/logo"
import { canClient, useApp } from "./app-context"
import { NAV, type NavLeaf } from "./nav-config"

export function AppSidebar() {
  const ctx = useApp()
  const pathname = usePathname()
  const visible = (l: NavLeaf) => canClient(ctx, l.perm)
  const locked = (l: NavLeaf) => !!l.feature && !ctx.plan.features[l.feature]
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(href + "/"))

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/app" className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <LogoMark className="size-7 shrink-0" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">{ctx.company.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{ctx.plan.name} plan</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => {
          const items = group.items.filter(visible)
          if (!items.length) return null
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => {
                  const children = item.children?.filter(visible)
                  const active = isActive(item.href) || !!children?.some((c) => isActive(c.href))
                  if (!children?.length)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.title}</span>
                            {locked(item) && <Lock className="ml-auto size-3 opacity-50" />}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  return (
                    <Collapsible key={item.href} asChild defaultOpen={active} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title}>
                            <item.icon />
                            <span>{item.title}</span>
                            {locked(item) ? (
                              <Lock className="ml-auto size-3 opacity-50" />
                            ) : (
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {children.map((c) => (
                              <SidebarMenuSubItem key={c.href}>
                                <SidebarMenuSubButton asChild isActive={pathname === c.href}>
                                  <Link href={c.href}>
                                    <span>{c.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
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
