"use client"

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: { fields?: Record<string, string> } & Record<string, unknown>,
  ) {
    super(message)
  }
}

type Envelope<T> =
  | { success: true; data: T; message: string | null; meta: unknown }
  | { success: false; error: { code: string; message: string; details: ApiError["details"] } }

let refreshing: Promise<boolean> | null = null

async function refresh(kind: "user" | "admin") {
  refreshing ??= fetch(`/api/v1/${kind === "admin" ? "admin/" : ""}auth/refresh`, { method: "POST" })
    .then((r) => r.ok)
    .finally(() => setTimeout(() => (refreshing = null), 0))
  return refreshing
}

async function request<T>(method: string, url: string, body?: unknown, opts: { idempotencyKey?: string } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {}
  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json"
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body) })
  let json: Envelope<T>
  try {
    json = await res.json()
  } catch {
    throw new ApiError("INTERNAL", "Unexpected server response", res.status)
  }
  if (json.success) return json.data
  if (json.error.code === "TOKEN_EXPIRED" && retry) {
    const kind = url.startsWith("/api/v1/admin") ? "admin" : "user"
    if (await refresh(kind)) return request<T>(method, url, body, opts, false)
    window.location.href = kind === "admin" ? "/admin/login" : `/login?next=${encodeURIComponent(location.pathname)}`
  }
  throw new ApiError(json.error.code, json.error.message, res.status, json.error.details ?? undefined)
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown, opts?: { idempotencyKey?: string }) => request<T>("POST", url, body ?? {}, opts),
  patch: <T>(url: string, body?: unknown, opts?: { idempotencyKey?: string }) => request<T>("PATCH", url, body ?? {}, opts),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}),
  delete: <T>(url: string) => request<T>("DELETE", url),
}

/** Push server-side field errors into react-hook-form. Returns true if any were applied. */
export function applyFieldErrors(err: unknown, setError: (name: never, e: { message: string }) => void) {
  if (err instanceof ApiError && err.details?.fields) {
    for (const [k, message] of Object.entries(err.details.fields)) setError(k as never, { message })
    return true
  }
  return false
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong")
