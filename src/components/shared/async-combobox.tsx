"use client"

import { useEffect, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { api } from "@/lib/api-client"
import { cn } from "@/lib/utils"

/**
 * Searchable remote picker. `endpoint` must return an array (API envelope data).
 * Use the typed wrappers in ./pickers.tsx rather than this directly.
 */
export function AsyncCombobox<T extends { id: string }>({
  endpoint,
  value,
  onChange,
  renderItem,
  renderValue,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  disabled,
  className,
  extraParams,
}: {
  endpoint: string
  value: T | null
  onChange: (v: T | null) => void
  renderItem: (v: T) => React.ReactNode
  renderValue: (v: T) => React.ReactNode
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  extraParams?: Record<string, string | undefined>
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const extra = JSON.stringify(extraParams ?? {})

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams({ q })
      for (const [k, v] of Object.entries(JSON.parse(extra) as Record<string, string | undefined>)) if (v) params.set(k, v)
      try {
        const data = await api.get<T[]>(`${endpoint}?${params}`)
        if (!cancelled) setItems(data)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, open, endpoint, extra])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-full justify-between px-3 font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value ? renderValue(value) : placeholder}</span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder={searchPlaceholder} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <CommandEmpty>No results.</CommandEmpty>
            )}
            {!loading && (
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.id}
                    onSelect={() => {
                      onChange(it)
                      setOpen(false)
                    }}
                  >
                    <div className="min-w-0 flex-1">{renderItem(it)}</div>
                    <Check className={cn("size-4", value?.id === it.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
