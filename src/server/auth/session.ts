import "server-only"
import { cookies, headers } from "next/headers"
import { prisma } from "@/server/db"
import { COOKIES, accessCookieOptions } from "./cookies"
import { randomToken, sha256 } from "./crypto"
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, signAccessToken, type AccessClaims } from "./jwt"

type Kind = "user" | "admin"
type Jar = Awaited<ReturnType<typeof cookies>>

export async function requestMeta() {
  const h = await headers()
  return {
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
    ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null,
  }
}

/** Create a refresh session + access token and set both cookies (AUTH-01). */
export async function issueSession(kind: Kind, subjectId: string, extra: Pick<AccessClaims, "cid" | "imp"> = {}) {
  const refresh = randomToken()
  const meta = await requestMeta()
  const session = await prisma.authSession.create({
    data: {
      subjectType: kind,
      subjectId,
      tokenHash: sha256(refresh),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      impersonatorId: extra.imp ?? null,
      ...meta,
    },
  })
  const access = await signAccessToken({ sub: subjectId, typ: kind, sid: session.id, ...extra })
  const jar = await cookies()
  jar.set(COOKIES[kind].access, access, accessCookieOptions(ACCESS_TTL_SECONDS))
  jar.set(COOKIES[kind].refresh, refresh, accessCookieOptions(REFRESH_TTL_SECONDS))
  return session
}

/** Rotate the refresh token and mint a new access token. Returns false when the session is gone. */
export async function refreshSession(kind: Kind): Promise<boolean> {
  const jar = await cookies()
  const token = jar.get(COOKIES[kind].refresh)?.value
  if (!token) return false
  const session = await prisma.authSession.findUnique({ where: { tokenHash: sha256(token) } })
  if (!session || session.subjectType !== kind || session.revokedAt || session.expiresAt < new Date()) {
    clearSessionCookies(jar, kind)
    return false
  }
  let cid: string | undefined
  if (kind === "user") {
    const user = await prisma.user.findUnique({ where: { id: session.subjectId }, select: { status: true, companyId: true } })
    if (!user || user.status !== "active") {
      await prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
      clearSessionCookies(jar, kind)
      return false
    }
    cid = user.companyId
  } else {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: session.subjectId }, select: { status: true } })
    if (!admin || admin.status !== "active") {
      clearSessionCookies(jar, kind)
      return false
    }
  }
  const next = randomToken()
  await prisma.authSession.update({ where: { id: session.id }, data: { tokenHash: sha256(next) } })
  const access = await signAccessToken({
    sub: session.subjectId,
    typ: kind,
    sid: session.id,
    cid,
    imp: session.impersonatorId ?? undefined,
  })
  jar.set(COOKIES[kind].access, access, accessCookieOptions(ACCESS_TTL_SECONDS))
  jar.set(COOKIES[kind].refresh, next, accessCookieOptions(REFRESH_TTL_SECONDS))
  return true
}

export async function revokeSession(kind: Kind) {
  const jar = await cookies()
  const token = jar.get(COOKIES[kind].refresh)?.value
  if (token) {
    await prisma.authSession.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } })
  }
  clearSessionCookies(jar, kind)
}

export async function revokeAllSessions(kind: Kind, subjectId: string) {
  await prisma.authSession.updateMany({
    where: { subjectType: kind, subjectId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

function clearSessionCookies(jar: Jar, kind: Kind) {
  jar.delete(COOKIES[kind].access)
  jar.delete(COOKIES[kind].refresh)
  if (kind === "user") jar.delete(COOKIES.branch)
}
