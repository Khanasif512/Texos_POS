export const COOKIES = {
  user: { access: "tx_at", refresh: "tx_rt" },
  admin: { access: "tx_aat", refresh: "tx_art" },
  branch: "tx_branch",
} as const

const secure = process.env.NODE_ENV === "production"

export const accessCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
})
