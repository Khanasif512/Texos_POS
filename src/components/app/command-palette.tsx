"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import {
  Bell,
  CornerDownLeft,
  FilePlus2,
  HandCoins,
  Languages,
  Loader2,
  Lock,
  Package,
  Search,
  Ship,
  Store,
  SunMoon,
  UserPlus,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { useI18n } from "@/components/i18n/i18n-provider"
import { api } from "@/lib/api-client"
import { money, quantity } from "@/lib/format"
import { NAV_ITEM_KEYS, NAV_SUB_KEYS } from "@/lib/i18n/nav"
import type { MessageKey } from "@/lib/i18n"
import type { PlanFeatures } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { canClient, useApp } from "./app-context"
import { NAV } from "./nav-config"

type CustomerHit = { id: string; code: string; name: string; phone: string | null; balance: number }
type VariationHit = { id: string; productId: string; productName: string; name: string; sku: string; unit: string; stock: number }

type Action = { key: MessageKey; href: string; icon: LucideIcon; perm?: string; feature?: keyof PlanFeatures; shortcut?: string }

const ACTIONS: Action[] = [
  { key: "palette.action.newSale", href: "/app/pos", icon: Store, perm: "sales.create" },
  { key: "palette.action.newLc", href: "/app/lc/new", icon: Ship, perm: "lc.create", feature: "lc" },
  { key: "palette.action.newCustomer", href: "/app/customers?new=1", icon: UserPlus, perm: "customers.create" },
  { key: "palette.action.newExpense", href: "/app/expenses?new=1", icon: Wallet, perm: "expenses.create" },
  { key: "palette.action.recordReceipt", href: "/app/sales/receipts/new", icon: HandCoins, perm: "sales.receipt" },
]

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const noopSubscribe = () => () => {}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** ⌘K / Ctrl+K command palette: pages, quick actions, live customer & product search. */
export function CommandPalette() {
  const ctx = useApp()
  const router = useRouter()
  const { t, tx, lang, setLang } = useI18n()
  const { resolvedTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const mac = useSyncExternalStore(noopSubscribe, isMac, () => false)
  const term = useDebounced(search.trim(), 250)
  const live = term.length >= 2

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const canCustomers = canClient(ctx, "customers.view")
  const canProducts = canClient(ctx, "inventory.view")

  const customers = useQuery({
    queryKey: ["palette", "customers", term],
    queryFn: () => api.get<CustomerHit[]>(`/api/v1/lookup/customers?q=${encodeURIComponent(term)}`),
    enabled: open && live && canCustomers,
    staleTime: 15_000,
  })
  const products = useQuery({
    queryKey: ["palette", "variations", term],
    queryFn: () => api.get<VariationHit[]>(`/api/v1/lookup/variations?limit=8&q=${encodeURIComponent(term)}`),
    enabled: open && live && canProducts,
    staleTime: 15_000,
  })
  const searching = live && ((customers.isFetching && canCustomers) || (products.isFetching && canProducts))

  /** Every nav entry the user may see (leaf pages only), labelled in the current language. */
  const pages = useMemo(() => {
    const out: { href: string; label: string; group: string; icon: LucideIcon; locked: boolean }[] = []
    for (const g of NAV)
      for (const item of g.items) {
        if (!canClient(ctx, item.perm)) continue
        const parent = tx(NAV_ITEM_KEYS[item.href], item.title)
        const itemLocked = !!item.feature && !ctx.plan.features[item.feature]
        const kids = item.children?.filter((c) => canClient(ctx, c.perm))
        if (!kids?.length) out.push({ href: item.href, label: parent, group: "", icon: item.icon, locked: itemLocked })
        else
          for (const c of kids)
            out.push({
              href: c.href,
              label: tx(NAV_SUB_KEYS[c.href], c.title),
              group: parent,
              icon: item.icon,
              locked: itemLocked || (!!c.feature && !ctx.plan.features[c.feature]),
            })
      }
    out.push({ href: "/app/notifications", label: t("nav.notifications"), group: "", icon: Bell, locked: false })
    out.push({ href: "/app/profile", label: t("nav.profile"), group: "", icon: UserRound, locked: false })
    return out
  }, [ctx, t, tx])

  const actions = ACTIONS.filter((a) => canClient(ctx, a.perm))

  const go = (href: string, locked = false) => {
    setOpen(false)
    if (locked) {
      toast(t("sidebar.lockedText"), {
        icon: <Lock className="size-4" />,
        action: { label: t("sidebar.upgrade"), onClick: () => router.push("/app/settings/billing") },
      })
      return
    }
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-9 justify-center gap-2 px-0 text-muted-foreground shadow-none sm:w-56 sm:justify-start sm:px-3 lg:w-64"
        aria-label={t("palette.title")}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left text-sm font-normal sm:inline">{t("topbar.search")}</span>
        <kbd className="pointer-events-none hidden h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium select-none sm:inline-flex">
          {mac ? "⌘" : "Ctrl"} K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setSearch("")
        }}
        title={t("palette.title")}
        description={t("palette.description")}
        className="sm:max-w-xl"
      >
        <Command className="rounded-none! bg-transparent p-0">
        <CommandInput value={search} onValueChange={setSearch} placeholder={t("palette.placeholder")} />
        <CommandList className="max-h-[min(420px,60vh)]">
          <CommandEmpty>
            {searching ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t("palette.searching")}
              </span>
            ) : (
              t("palette.empty")
            )}
          </CommandEmpty>

          {actions.length > 0 && (
            <CommandGroup heading={t("palette.group.actions")}>
              {actions.map((a) => {
                const locked = !!a.feature && !ctx.plan.features[a.feature]
                return (
                  <CommandItem key={a.href} value={`action ${t(a.key)} ${a.href}`} onSelect={() => go(a.href, locked)}>
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <a.icon className="size-3.5" />
                    </span>
                    <span className="flex-1">{t(a.key)}</span>
                    {locked ? <Lock className="size-3 opacity-60" /> : <FilePlus2 className="size-3.5 opacity-40" />}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          {live && canCustomers && (customers.data?.length ?? 0) > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("palette.group.customers")}>
                {customers.data!.map((c) => (
                  <CommandItem key={c.id} value={`customer ${c.id} ${c.name} ${c.phone ?? ""} ${c.code}`} keywords={[term]} onSelect={() => go(`/app/customers/${c.id}`)}>
                    <UserRound className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {c.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {c.code}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </span>
                    </span>
                    {c.balance > 0 && <span className="num text-xs text-muted-foreground">{t("palette.balance", { amount: money(c.balance) })}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {live && canProducts && (products.data?.length ?? 0) > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("palette.group.products")}>
                {products.data!.map((v) => (
                  <CommandItem key={v.id} value={`product ${v.id} ${v.productName} ${v.name} ${v.sku}`} keywords={[term]} onSelect={() => go(`/app/products/${v.productId}`)}>
                    <Package className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {v.productName}
                      {v.name && v.name !== v.productName && <span className="text-muted-foreground"> — {v.name}</span>}
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{v.sku}</span>
                    </span>
                    <span className={cn("num text-xs", v.stock > 0 ? "text-muted-foreground" : "text-destructive")}>
                      {t("palette.stock", { qty: `${quantity(v.stock)} ${v.unit}` })}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading={t("palette.group.pages")}>
            {pages.map((p) => (
              <CommandItem key={p.href} value={`page ${p.group} ${p.label} ${p.href}`} onSelect={() => go(p.href, p.locked)}>
                <p.icon className="text-muted-foreground" />
                <span className="flex-1 truncate">
                  {p.group && <span className="text-muted-foreground">{p.group} / </span>}
                  {p.label}
                </span>
                {p.locked && <Lock className="size-3 opacity-60" />}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading={t("palette.group.preferences")}>
            <CommandItem
              value="pref theme dark light mode"
              onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
                setOpen(false)
              }}
            >
              <SunMoon className="text-muted-foreground" />
              {t("palette.action.theme")}
            </CommandItem>
            <CommandItem
              value="pref language bangla bengali english বাংলা"
              onSelect={() => {
                setOpen(false)
                void setLang(lang === "bn" ? "en" : "bn")
              }}
            >
              <Languages className="text-muted-foreground" />
              {t("palette.action.language")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span className="truncate">{live || (!canCustomers && !canProducts) ? t("palette.description") : t("palette.minChars")}</span>
          <span className="hidden items-center gap-1 sm:flex">
            <CornerDownLeft className="size-3" /> ↑↓ · Esc
          </span>
        </div>
        </Command>
      </CommandDialog>
    </>
  )
}
