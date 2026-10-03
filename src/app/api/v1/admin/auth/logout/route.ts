import { handle, ok } from "@/server/api"
import { revokeSession } from "@/server/auth/session"

export const POST = handle(async () => {
  await revokeSession("admin")
  return ok({ redirect: "/admin/login" })
})
