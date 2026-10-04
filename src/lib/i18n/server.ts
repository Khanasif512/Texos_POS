import "server-only"
import { cookies } from "next/headers"
import { LANG_COOKIE, makeT, normalizeLang, type Lang } from "./index"

/** UI language for Server Components (from the `tx_lang` cookie). */
export async function getLang(): Promise<Lang> {
  return normalizeLang((await cookies()).get(LANG_COOKIE)?.value)
}

/** Translator for Server Components: `const t = await getT()`. */
export async function getT() {
  return makeT(await getLang())
}
