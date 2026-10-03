import "server-only"
import { Prisma } from "@/generated/prisma/client"

export const Decimal = Prisma.Decimal
export type Dec = Prisma.Decimal
type In = Prisma.Decimal | number | string | null | undefined

/** Safe Decimal constructor (null/undefined → 0). Never use JS floats for money. */
export const dec = (v: In) => new Prisma.Decimal(v == null || v === "" ? 0 : v)
export const sum = (vals: In[]) => vals.reduce<Prisma.Decimal>((a, v) => a.plus(dec(v)), dec(0))
export const round2 = (v: In) => dec(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
export const round4 = (v: In) => dec(v).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
/** For JSON responses / client props. */
export const num = (v: In) => (v == null ? 0 : Number(v.toString()))
