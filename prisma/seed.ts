import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "../src/generated/prisma/client"
import { DEFAULT_PLANS } from "../src/lib/plans"
import { provisionCompany, syncPermissions } from "../src/server/modules/tenants/provision"

const url = new URL(process.env.DATABASE_URL!)
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  }),
})

/** Demo tenant login (local development only). */
const DEMO_OWNER = { email: "owner@gkinterior.test", password: "Demo@12345" }

async function main() {
  for (const p of DEFAULT_PLANS) {
    const data = {
      name: p.name,
      tagline: p.tagline,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      maxBranches: p.maxBranches,
      maxEmployees: p.maxEmployees,
      maxProducts: p.maxProducts,
      features: p.features,
      isDefaultTrial: p.isDefaultTrial ?? false,
      sortOrder: p.sortOrder,
    }
    await prisma.plan.upsert({ where: { code: p.code }, update: data, create: { code: p.code, ...data } })
  }
  await syncPermissions(prisma)
  console.log("✔ plans & permissions")

  if (process.env.NODE_ENV === "production" && (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD))
    throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env before seeding production")
  const adminEmail = process.env.SUPER_ADMIN_EMAIL ?? "admin@texonpos.test"
  if (!(await prisma.platformAdmin.findUnique({ where: { email: adminEmail } }))) {
    await prisma.platformAdmin.create({
      data: {
        name: "Platform Owner",
        email: adminEmail,
        passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? "Admin@12345", 12),
        isOwner: true,
      },
    })
  }
  console.log(`✔ super admin ${adminEmail}`)

  // Demo tenant only outside production (or when SEED_DEMO=1 is set explicitly).
  const seedDemo = process.env.SEED_DEMO === "1" || (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO !== "0")
  if (!seedDemo) {
    console.log("• demo tenant skipped (production)")
    return
  }
  if (!(await prisma.user.findUnique({ where: { email: DEMO_OWNER.email } }))) {
    await prisma.$transaction(
      async (tx) => {
        const { company } = await provisionCompany(tx, {
          companyName: "GK Interior",
          email: DEMO_OWNER.email,
          ownerName: "GK Owner",
          phone: "+8801700000000",
          passwordHash: await bcrypt.hash(DEMO_OWNER.password, 12),
          businessType: "Aluminium, glass & home decor importer",
        })
        await tx.company.update({
          where: { id: company.id },
          data: { address: "Nawabpur Road, Dhaka 1100", status: "active" },
        })
        await tx.branch.createMany({
          data: [
            { companyId: company.id, code: "CTG", name: "Chattogram Showroom", address: "Agrabad C/A, Chattogram" },
            { companyId: company.id, code: "WH1", name: "Tejgaon Warehouse", address: "Tejgaon I/A, Dhaka" },
          ],
        })
      },
      { timeout: 30_000 },
    )
  }
  console.log(`✔ demo tenant GK Interior (${DEMO_OWNER.email})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
