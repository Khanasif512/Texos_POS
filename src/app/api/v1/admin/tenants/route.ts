import { AppError } from "@/server/errors"
import { ok, parseBody } from "@/server/api"
import { adminRoute } from "@/server/auth/admin-context"
import { hashPassword } from "@/server/auth/crypto"
import { prisma } from "@/server/db"
import { audit } from "@/server/audit"
import { provisionCompany } from "@/server/modules/tenants/provision"
import { signupSchema } from "@/lib/validation/public"

export const POST = adminRoute(async ({ req, admin }) => {
  const input = await parseBody(req, signupSchema)
  const email = input.email.toLowerCase()
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AppError("CONFLICT", "An account with this email already exists.", {
      fields: { email: "This email is already registered" },
    })
  }

  if (input.plan && !(await prisma.plan.findFirst({ where: { code: input.plan, status: "active" }, select: { id: true } }))) {
    throw new AppError("VALIDATION_ERROR", "Choose an active plan.", { fields: { plan: "Choose an active plan" } })
  }

  const passwordHash = await hashPassword(input.password)
  const company = await prisma.$transaction(
    async (tx) => {
      const { company } = await provisionCompany(tx, {
        companyName: input.companyName,
        email,
        ownerName: input.ownerName,
        phone: input.phone || null,
        passwordHash,
        planCode: input.plan || undefined,
      })
      await audit(
        { admin, companyId: company.id },
        { action: "create", entityType: "company", entityId: company.id, summary: `Created tenant ${company.name}` },
        tx,
      )
      return company
    },
    { timeout: 20_000 },
  )

  return ok({ id: company.id }, { status: 201, message: "Tenant created" })
})
