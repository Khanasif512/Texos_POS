import "server-only"
import { AppError } from "./errors"

// In-memory fixed-window limiter (per instance). Swap for Redis when the API is scaled horizontally.
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  b.count++
  if (b.count > limit) {
    const secs = Math.ceil((b.resetAt - now) / 1000)
    throw new AppError("RATE_LIMITED", `Too many attempts. Please try again in ${secs} seconds.`)
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local"
}
