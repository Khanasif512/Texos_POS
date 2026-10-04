import { describe, expect, it } from "vitest"
import { en } from "@/lib/i18n/en"
import { bn } from "@/lib/i18n/bn"
import { langFromCookieString, placeholders, translate, translateLoose } from "@/lib/i18n"
import { NAV_GROUP_KEYS, NAV_ITEM_KEYS, NAV_SUB_KEYS, bestMatch } from "@/lib/i18n/nav"

describe("i18n dictionaries", () => {
  it("every English key exists in Bengali and nothing extra", () => {
    expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort())
  })
  it("Bengali values are non-empty and keep the same placeholders", () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(bn[k].trim(), k).not.toBe("")
      expect(placeholders(bn[k]), k).toEqual(placeholders(en[k]))
    }
  })
  it("nav key maps only reference existing keys", () => {
    for (const k of [...Object.values(NAV_GROUP_KEYS), ...Object.values(NAV_ITEM_KEYS), ...Object.values(NAV_SUB_KEYS)]) expect(en).toHaveProperty([k])
  })
})

describe("translate", () => {
  it("fills placeholders and switches language", () => {
    expect(translate("en", "banner.trialMany", { days: 5, plan: "Growth" })).toBe("5 days left in your free trial of the Growth plan.")
    expect(translate("bn", "nav.inventory")).toBe("মজুদ")
    expect(translate("bn", "nav.lc")).toBe("এলসি ব্যবস্থাপনা")
  })
  it("loose lookup falls back to the given English text", () => {
    expect(translateLoose("bn", "nav.customers", "Customers")).toBe("গ্রাহক")
    expect(translateLoose("bn", "nav.unknown", "Brand new page")).toBe("Brand new page")
    expect(translateLoose("bn", undefined, "Fallback")).toBe("Fallback")
  })
  it("reads the language cookie", () => {
    expect(langFromCookieString("tx_branch=abc; tx_lang=bn; x=1")).toBe("bn")
    expect(langFromCookieString("tx_lang=fr")).toBe("en")
    expect(langFromCookieString("")).toBe("en")
  })
})

describe("nav active matching", () => {
  const hrefs = ["/app", "/app/lc", "/app/lc/new", "/app/products", "/app/inventory", "/app/inventory/low-stock"]
  it("picks the longest matching prefix", () => {
    expect(bestMatch("/app/lc/new", hrefs)).toBe("/app/lc/new")
    expect(bestMatch("/app/lc/abc123", hrefs)).toBe("/app/lc")
    expect(bestMatch("/app/inventory/low-stock", hrefs)).toBe("/app/inventory/low-stock")
    expect(bestMatch("/app", hrefs)).toBe("/app")
    expect(bestMatch("/app/profile", hrefs)).toBeNull()
    expect(bestMatch("/app/lcx", hrefs)).toBeNull()
  })
})
