import { ok, parseBody } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { idempotent } from "@/server/idempotency"
import { createOpeningStock, recentOpeningEntries } from "@/server/modules/inventory-ops/service"
import { openingStockSchema } from "@/lib/validation/inventory"

/** GET /api/v1/inventory/opening — recent opening-stock postings. */
export const GET = tenantRoute({ perm: "inventory.adjust" }, async ({ ctx }) => ok(await recentOpeningEntries(ctx)))

/** POST /api/v1/inventory/opening — migrate existing inventory (batch "OPENING"). Send an Idempotency-Key header. */
export const POST = tenantRoute({ perm: "inventory.adjust" }, async ({ req, ctx }) => {
  const input = await parseBody(req, openingStockSchema)
  return idempotent(req, ctx.companyId, "inventory.opening", async () => ({
    data: await createOpeningStock(ctx, input),
    message: "Opening stock posted",
    status: 201,
  }))
})
