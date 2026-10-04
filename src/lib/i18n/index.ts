import { bn } from "./bn"
import { en, type MessageKey } from "./en"

export type { MessageKey }
export type Lang = "en" | "bn"
export type Vars = Record<string, string | number>
export type Translate = (key: MessageKey, vars?: Vars) => string

/** Cookie holding the UI language. Readable by client JS on purpose (not a secret). */
export const LANG_COOKIE = "tx_lang"
export const LANGS: Lang[] = ["en", "bn"]
export const DEFAULT_LANG: Lang = "en"

export const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, bn }

export const normalizeLang = (v: string | null | undefined): Lang => (v === "bn" ? "bn" : "en")

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s)

/** Translate a key; falls back to English, then to the key itself. */
export function translate(lang: Lang, key: MessageKey, vars?: Vars): string {
  return fill(dictionaries[lang][key] ?? en[key] ?? key, vars)
}

export const isMessageKey = (k: string): k is MessageKey => k in en

/** Loose lookup for keys built at runtime (e.g. nav hrefs) — returns `fallback` when the key is unknown. */
export function translateLoose(lang: Lang, key: string | undefined, fallback: string, vars?: Vars): string {
  return key && isMessageKey(key) ? translate(lang, key, vars) : fill(fallback, vars)
}

export function makeT(lang: Lang): Translate {
  return (key, vars) => translate(lang, key, vars)
}

/** Parse the language out of a raw `document.cookie` string. */
export function langFromCookieString(cookie: string | undefined | null): Lang {
  const m = (cookie ?? "").match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`))
  return normalizeLang(m?.[1])
}

/** Placeholders used in a message (for completeness tests). */
export const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()
