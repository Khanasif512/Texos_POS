import { handle, ok, parseBody } from "@/server/api"
import { prisma } from "@/server/db"
import { clientIp, rateLimit } from "@/server/rate-limit"
import { contactSchema } from "@/lib/validation/public"

export const POST = handle(async (req) => {
  rateLimit(`contact:${clientIp(req)}`, 5, 60 * 60 * 1000)
  const body = await parseBody(req, contactSchema)
  await prisma.contactMessage.create({
    data: { name: body.name, email: body.email, phone: body.phone || null, company: body.company || null, message: body.message },
  })
  return ok({ received: true }, { message: "Message received", status: 201 })
})
