"use client"

import { createContext, useContext } from "react"
import type { PublicContext } from "@/server/auth/context"

const Ctx = createContext<PublicContext | null>(null)

export function AppContextProvider({ value, children }: { value: PublicContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useApp must be used inside the app shell")
  return v
}

export function canClient(ctx: PublicContext, perm?: string | string[]) {
  if (!perm) return true
  if (ctx.permissions.includes("*")) return true
  return (Array.isArray(perm) ? perm : [perm]).some((p) => ctx.permissions.includes(p))
}

export function useCan(perm?: string | string[]) {
  return canClient(useApp(), perm)
}
