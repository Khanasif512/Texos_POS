import { NextResponse } from "next/server"
import { prisma } from "@/server/db"

export const dynamic = "force-dynamic"

/** Uptime / load-balancer probe: 200 when the app and database respond. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", time: new Date().toISOString() })
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 })
  }
}
