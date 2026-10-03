import bcrypt from "bcryptjs"
import { createHash, randomBytes, randomInt } from "node:crypto"

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex")
export const randomToken = (bytes = 48) => randomBytes(bytes).toString("base64url")
export const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0")
