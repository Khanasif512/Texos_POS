import { NextResponse } from "next/server"
import { fail, handle, ok } from "@/server/api"
import { refreshSession } from "@/server/auth/session"

const safeNext = (v: string | null) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/app")

/** Page navigations with an expired access token land here, then bounce back. */
export const GET = handle(async (req) => {
  const next = safeNext(new URL(req.url).searchParams.get("next"))
  const refreshed = await refreshSession("user")
  return NextResponse.redirect(new URL(refreshed ? next : `/login?next=${encodeURIComponent(next)}`, req.url))
})

/** XHR refresh used by the API client on TOKEN_EXPIRED. */
export const POST = handle(async () => {
  return (await refreshSession("user")) ? ok({ refreshed: true }) : fail("UNAUTHENTICATED", "Session ended", 401)
})
