import "server-only"
import type { PlanFeatures } from "@/lib/permissions"
import { handle } from "./api"
import { assertFeature, assertWritable, requirePermission, tenantFromRequest, type TenantContext } from "./auth/context"
import { tenantDb, type TenantDb } from "./db"

type Opts = {
  /** user needs at least one of these permissions */
  perm?: string | string[]
  /** plan feature required (TEN-03) */
  feature?: keyof PlanFeatures
  /** allow writes even when the workspace is read-only (billing, own profile/password) */
  allowReadOnly?: boolean
}

type Params = Promise<Record<string, string>>

/**
 * Authenticated tenant route: resolves the session, enforces permission, plan feature,
 * and read-only lock for mutating methods, and hands over a tenant-scoped Prisma client.
 */
export function tenantRoute(
  opts: Opts,
  fn: (args: { req: Request; ctx: TenantContext; db: TenantDb; params: Record<string, string> }) => Promise<Response>,
) {
  return handle<{ params: Params }>(async (req, routeCtx) => {
    const ctx = await tenantFromRequest()
    if (opts.perm) requirePermission(ctx, ...(Array.isArray(opts.perm) ? opts.perm : [opts.perm]))
    if (opts.feature) assertFeature(ctx, opts.feature)
    if (!opts.allowReadOnly && req.method !== "GET" && req.method !== "HEAD") assertWritable(ctx)
    const params = routeCtx?.params ? await routeCtx.params : {}
    return fn({ req, ctx, db: tenantDb(ctx.companyId), params })
  })
}
