"use client"

import { Languages } from "lucide-react"
import { toast } from "sonner"
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut } from "@/components/ui/dropdown-menu"
import { translate, type Lang } from "@/lib/i18n"
import { useI18n } from "./i18n-provider"

/** EN / বাং switch rendered inside a DropdownMenuContent (the user menu). */
export function LanguageMenuItems() {
  const { lang, t, setLang } = useI18n()
  const change = (v: string) => {
    const next = v as Lang
    if (next === lang) return
    void setLang(next)
    toast.success(translate(next, "lang.changed"))
  }
  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
        <Languages className="size-3.5" /> {t("lang.label")}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup value={lang} onValueChange={change}>
        <DropdownMenuRadioItem value="en">
          {t("lang.en")}
          <DropdownMenuShortcut>EN</DropdownMenuShortcut>
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="bn" lang="bn">
          {t("lang.bn")}
          <DropdownMenuShortcut>বাং</DropdownMenuShortcut>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  )
}
