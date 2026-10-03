import { ok, parseBody } from "@/server/api"
import { prisma } from "@/server/db"
import { tenantRoute } from "@/server/route"
import { profileSchema } from "@/lib/validation/org"

export const PATCH = tenantRoute({ allowReadOnly: true }, async ({ req, ctx }) => {
  const body = await parseBody(req, profileSchema)
  await prisma.user.update({ where: { id: ctx.userId }, data: body })
  return ok({ id: ctx.userId }, { message: "Profile saved" })
})
