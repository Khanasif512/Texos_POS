import "server-only"
import { prisma } from "./db"
import { ok } from "./api"

/**
 * Idempotency for financial mutations (SRS §3.3): if the client resends the same
 * Idempotency-Key header, the first response is returned instead of creating a duplicate.
 */
export async function idempotent<T>(req: Request, companyId: string, route: string, fn: () => Promise<{ data: T; message?: string; status?: number }>) {
  const key = req.headers.get("idempotency-key")?.slice(0, 100)
  if (key) {
    const hit = await prisma.idempotencyKey.findUnique({ where: { key: `${companyId}:${key}` } })
    if (hit) return ok(hit.response as T, { message: "Already processed" })
  }
  const res = await fn()
  if (key) {
    await prisma.idempotencyKey
      .create({ data: { key: `${companyId}:${key}`, companyId, route, response: JSON.parse(JSON.stringify(res.data)) } })
      .catch(() => {})
  }
  return ok(res.data, { message: res.message, status: res.status })
}
