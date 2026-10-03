import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"
import { dashboardData } from "@/server/modules/finance/dashboard"

/** GET /api/v1/dashboard — today's KPIs and widgets for the user's permitted branches (blocks the role cannot see are null). */
export const GET = tenantRoute({ perm: "dashboard.view" }, async ({ ctx }) => ok(await dashboardData(ctx)))
