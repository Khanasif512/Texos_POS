import { z } from "zod"
import { handle, ok, parseBody } from "@/server/api"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { resendOtp } from "@/server/modules/auth/service"

export const POST = handle(async (req) => {
  rateLimit(`resend:${clientIp(req)}`, 5, 15 * 60 * 1000)
  const { verificationId } = await parseBody(req, z.object({ verificationId: z.string().min(10) }))
  await resendOtp(verificationId)
  return ok({ sent: true }, { message: "A new code has been sent" })
})
