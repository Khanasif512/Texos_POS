import { cookies } from "next/headers"
import { handle, ok, parseBody } from "@/server/api"
import { LANG_COOKIE } from "@/lib/i18n"
import { languageSchema } from "@/server/modules/notifications/schema"

/**
 * POST /api/v1/preferences/language { lang: "en" | "bn" } — stores the UI language in the `tx_lang` cookie.
 * Not httpOnly on purpose: client components read it to render without a round trip. No auth needed.
 */
export const POST = handle(async (req: Request) => {
  const { lang } = await parseBody(req, languageSchema)
  ;(await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })
  return ok({ lang })
})
