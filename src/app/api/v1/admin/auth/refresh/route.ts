import { NextResponse } from "next/server"
import { fail, handle, ok } from "@/server/api"
import { refreshSession } from "@/server/auth/session"

const safeNext = (v: string | null) => (v && v.startsWith("/admin") ? v : "/admin")

export const GET = handle(async (req) => {
  const next = safeNext(new URL(req.url).searchParams.get("next"))
  const refreshed = await refreshSession("admin")
  return NextResponse.redirect(new URL(refreshed ? next : "/admin/login", req.url))
})

export const POST = handle(async () => {
  return (await refreshSession("admin")) ? ok({ refreshed: true }) : fail("UNAUTHENTICATED", "Session ended", 401)
})
