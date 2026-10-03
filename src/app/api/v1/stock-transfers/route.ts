import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { createTransfer } from "@/server/modules/inventory-ops/service"
import { listTransfers, TRF_SORTABLE } from "@/server/modules/inventory-ops/queries"
import { listArgsFromRequest, listMeta } from "@/server/modules/inventory-ops/shared"
import { transferSchema } from "@/lib/validation/inventory"

const OPTS = { perm: "inventory.transfer", feature: "multiBranchTransfer" } as const

/** GET /api/v1/stock-transfers?q&status&direction=in|out&branchId&from&to&page&limit&sort */
export const GET = tenantRoute(OPTS, async ({ req, ctx }) => {
  const p = listArgsFromRequest(req, { sortable: TRF_SORTABLE, defaultSort: "date:desc" })
  const res = await listTransfers(ctx, { ...p, direction: p.get("direction") })
  return ok(res.rows, { meta: listMeta(p, res.total) })
})

/** POST /api/v1/stock-transfers — dispatch: stock leaves the source branch now (FIFO, transfer_out). */
export const POST = tenantRoute(OPTS, async ({ req, ctx }) => {
  const input = await parseBody(req, transferSchema)
  return idempotent(req, ctx.companyId, "stock-transfers.create", async () => ({
    data: await createTransfer(ctx, input),
    message: "Transfer dispatched",
    status: 201,
  }))
})
