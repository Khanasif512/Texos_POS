import "server-only"

/** Shared list params for server-rendered tables (pages receive `searchParams`). */
export type ListSearchParams = Record<string, string | string[] | undefined>

export function readListParams(sp: ListSearchParams, opts: { sortable?: string[]; defaultSort?: string; pageSize?: number } = {}) {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined))
  const page = Math.max(1, Number(get("page")) || 1)
  const limit = Math.min(100, Math.max(5, Number(get("limit")) || opts.pageSize || 20))
  const [field, dir] = (get("sort") || opts.defaultSort || "createdAt:desc").split(":")
  const defaultField = (opts.defaultSort || "createdAt:desc").split(":")[0]
  const sortField = opts.sortable?.includes(field) ? field : defaultField
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    sort: `${sortField}:${dir === "asc" ? "asc" : "desc"}`,
    orderBy: { [sortField]: dir === "asc" ? "asc" : "desc" } as Record<string, "asc" | "desc">,
    q: get("q")?.trim() || undefined,
    from: get("from") || undefined,
    to: get("to") || undefined,
    branchId: get("branchId") || undefined,
    status: get("status") || undefined,
    get,
  }
}

/** Inclusive date range filter for a DateTime column; `to` covers the whole day. */
export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined
  const r: { gte?: Date; lte?: Date } = {}
  if (from) r.gte = new Date(`${from}T00:00:00`)
  if (to) r.lte = new Date(`${to}T23:59:59.999`)
  return r
}
