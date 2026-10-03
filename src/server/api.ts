import "server-only"
import { NextResponse } from "next/server"
import { ZodError, type ZodType } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { AppError } from "./errors"

/** SRS §3.3 response envelope. */
export function ok<T>(data: T, init?: { message?: string; meta?: unknown; status?: number }) {
  return NextResponse.json(
    { success: true, data, message: init?.message ?? null, meta: init?.meta ?? null },
    { status: init?.status ?? 200 },
  )
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ success: false, error: { code, message, details: details ?? null } }, { status })
}

export function toErrorResponse(err: unknown) {
  if (err instanceof AppError) return fail(err.code, err.message, err.status, err.details)
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const issue of err.issues) fields[issue.path.join(".")] ??= issue.message
    return fail("VALIDATION_ERROR", "Please check the highlighted fields", 422, { fields })
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return fail("CONFLICT", "A record with the same unique value already exists", 409, { target: err.meta?.target })
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return fail("NOT_FOUND", "Record not found", 404)
  }
  console.error("[api] unhandled error", err)
  return fail("INTERNAL", "Something went wrong. Please try again.", 500)
}

/** Wrap a route handler so thrown errors become envelopes. */
export function handle<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      return toErrorResponse(err)
    }
  }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body")
  }
  return schema.parse(json)
}

/** ?page&limit&sort=field:asc&q */
export function listParams(req: Request, allowedSort: string[] = [], defaultSort = "createdAt:desc") {
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, Number(sp.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20))
  const [field, dir] = (sp.get("sort") || defaultSort).split(":")
  const sortField = allowedSort.includes(field) ? field : defaultSort.split(":")[0]
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    orderBy: { [sortField]: dir === "asc" ? "asc" : "desc" } as Record<string, "asc" | "desc">,
    q: sp.get("q")?.trim() || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    branchId: sp.get("branchId") || undefined,
    sp,
  }
}
