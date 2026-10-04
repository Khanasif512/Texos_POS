"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  langFromCookieString,
  makeT,
  translateLoose,
  type Lang,
  type Translate,
  type Vars,
} from "@/lib/i18n"

/**
 * The `tx_lang` cookie is the single source of truth. The provider only supplies the value the server
 * rendered with (so hydration matches); afterwards the cookie store drives re-renders. Components
 * calling `useT()` outside a provider still work — they render English on the server and switch
 * to the cookie language right after hydration.
 */
const InitialLang = createContext<Lang | null>(null)

const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => langFromCookieString(document.cookie)

function writeLangCookie(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  listeners.forEach((l) => l())
}

export function I18nProvider({ lang, children }: { lang?: Lang; children: React.ReactNode }) {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => lang ?? DEFAULT_LANG)
  useEffect(() => {
    document.documentElement.lang = current
  }, [current])
  return <InitialLang.Provider value={lang ?? DEFAULT_LANG}>{children}</InitialLang.Provider>
}

export function useI18n() {
  const initial = useContext(InitialLang)
  const router = useRouter()
  const lang = useSyncExternalStore(subscribe, getSnapshot, () => initial ?? DEFAULT_LANG)
  const t: Translate = useMemo(() => makeT(lang), [lang])
  const tx = useCallback((key: string | undefined, fallback: string, vars?: Vars) => translateLoose(lang, key, fallback, vars), [lang])
  const setLang = useCallback(
    async (next: Lang) => {
      writeLangCookie(next)
      // Persist server-side too (same cookie, set by the API) and re-render Server Components in the new language.
      await api.post("/api/v1/preferences/language", { lang: next }).catch(() => {})
      router.refresh()
    },
    [router],
  )
  return { lang, t, tx, setLang }
}

/** `const t = useT(); t("nav.dashboard")` */
export function useT(): Translate {
  return useI18n().t
}
