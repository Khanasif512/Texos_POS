import { SignJWT, jwtVerify, errors } from "jose"

export type AccessClaims = {
  sub: string
  typ: "user" | "admin"
  /** company id (tenant users only) */
  cid?: string
  /** session id — lets logout/revocation invalidate quickly */
  sid: string
  /** impersonating platform admin id */
  imp?: string
}

const secret = () => new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)
export const ACCESS_TTL_SECONDS = 15 * 60
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60

export async function signAccessToken(claims: AccessClaims) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("texonpos")
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret())
}

export type VerifyResult = { ok: true; claims: AccessClaims } | { ok: false; expired: boolean }

export async function verifyAccessToken(token: string | undefined): Promise<VerifyResult> {
  if (!token) return { ok: false, expired: false }
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "texonpos" })
    return { ok: true, claims: payload as unknown as AccessClaims }
  } catch (e) {
    return { ok: false, expired: e instanceof errors.JWTExpired }
  }
}
