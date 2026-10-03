import { NextResponse, type NextRequest } from "next/server"
import { COOKIES } from "@/server/auth/cookies"
import { verifyAccessToken } from "@/server/auth/jwt"

/**
 * Optimistic route guard. Real authorization happens in every page/route via the tenant context;
 * this only avoids rendering protected pages for visitors without a session.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const isAdmin = pathname.startsWith("/admin")
  if (isAdmin && pathname.startsWith("/admin/login")) return NextResponse.next()

  const names = isAdmin ? COOKIES.admin : COOKIES.user
  const v = await verifyAccessToken(req.cookies.get(names.access)?.value)
  if (v.ok && v.claims.typ === (isAdmin ? "admin" : "user")) return NextResponse.next()

  const next = encodeURIComponent(pathname + search)
  if (req.cookies.has(names.refresh)) {
    const refreshUrl = isAdmin ? `/api/v1/admin/auth/refresh?next=${next}` : `/api/v1/auth/refresh?next=${next}`
    return NextResponse.redirect(new URL(refreshUrl, req.url))
  }
  return NextResponse.redirect(new URL(isAdmin ? "/admin/login" : `/login?next=${next}`, req.url))
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/print/:path*"],
}
