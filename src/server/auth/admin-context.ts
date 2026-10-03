import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/server/db"
import { handle } from "@/server/api"
import { AppError } from "@/server/errors"
import { COOKIES } from "./cookies"
import { verifyAccessToken } from "./jwt"

export type AdminContext = { id: string; name: string; email: string; isOwner: boolean }

const load = cache(async (): Promise<AdminContext | "expired" | null> => {
  const jar = await cookies()
  const v = await verifyAccessToken(jar.get(COOKIES.admin.access)?.value)
  if (!v.ok) return v.expired || jar.has(COOKIES.admin.refresh) ? "expired" : null
  if (v.claims.typ !== "admin") return null
  const [admin, session] = await Promise.all([
    prisma.platformAdmin.findUnique({ where: { id: v.claims.sub } }),
    prisma.authSession.findUnique({ where: { id: v.claims.sid }, select: { revokedAt: true } }),
  ])
  if (!admin || admin.status !== "active" || !session || session.revokedAt) return null
  return { id: admin.id, name: admin.name, email: admin.email, isOwner: admin.isOwner }
})

export async function requireAdmin(next = "/admin") {
  const a = await load()
  if (a === "expired") redirect(`/api/v1/admin/auth/refresh?next=${encodeURIComponent(next)}`)
  if (!a) redirect("/admin/login")
  return a
}

export async function adminFromRequest() {
  const a = await load()
  if (a === "expired") throw new AppError("TOKEN_EXPIRED", "Session expired")
  if (!a) throw new AppError("UNAUTHENTICATED", "Please sign in")
  return a
}

export function adminRoute(
  fn: (args: { req: Request; admin: AdminContext; params: Record<string, string> }) => Promise<Response>,
) {
  return handle<{ params: Promise<Record<string, string>> }>(async (req, routeCtx) => {
    const admin = await adminFromRequest()
    const params = routeCtx?.params ? await routeCtx.params : {}
    return fn({ req, admin, params })
  })
}
