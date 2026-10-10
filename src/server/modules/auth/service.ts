import "server-only"
import { prisma } from "@/server/db"
import { AppError } from "@/server/errors"
import { layout, sendMail } from "@/server/mail"
import { generateOtp, hashPassword, randomToken, sha256, verifyPassword } from "@/server/auth/crypto"
import { issueSession, revokeAllSessions } from "@/server/auth/session"
import { provisionCompany } from "@/server/modules/tenants/provision"
import type { SignupInput } from "@/lib/validation/public"

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5
const MAX_FAILED_LOGINS = 5
const LOCK_MS = 15 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000"

// ───────── Signup (TEN-01) ─────────

const otpRequired = () => process.env.SIGNUP_OTP_REQUIRED === "true"

const otpDisabled = () => new AppError("BUSINESS_RULE", "Email verification is turned off.")

export async function startSignup(input: SignupInput) {
  const email = input.email.toLowerCase()
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } }))
    throw new AppError("CONFLICT", "An account with this email already exists. Try signing in.", {
      fields: { email: "This email is already registered" },
    })

  if (!otpRequired()) {
    await createWorkspace(
      {
        email,
        companyName: input.companyName,
        ownerName: input.ownerName,
        phone: input.phone || null,
        passwordHash: await hashPassword(input.password),
      },
      input.plan,
    )
    return { verificationRequired: false as const, email }
  }

  const otp = generateOtp()
  const v = await prisma.emailVerification.create({
    data: {
      email,
      companyName: input.companyName,
      ownerName: input.ownerName,
      phone: input.phone || null,
      passwordHash: await hashPassword(input.password),
      otpHash: sha256(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })
  await sendOtpMail(email, input.ownerName, otp)
  return { verificationRequired: true as const, verificationId: v.id, email }
}

export async function resendOtp(verificationId: string) {
  if (!otpRequired()) throw otpDisabled()
  const v = await prisma.emailVerification.findUnique({ where: { id: verificationId } })
  if (!v || v.verifiedAt) throw new AppError("NOT_FOUND", "This signup request is no longer valid. Please start again.")
  const otp = generateOtp()
  await prisma.emailVerification.update({
    where: { id: v.id },
    data: { otpHash: sha256(otp), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  })
  await sendOtpMail(v.email, v.ownerName, otp)
}

async function sendOtpMail(email: string, name: string, otp: string) {
  await sendMail({
    to: email,
    subject: `${otp} is your TexonPOS verification code`,
    text: `Hi ${name},\n\nYour verification code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    html: layout(
      "Verify your email",
      `<p>Hi ${escapeHtml(name)},</p><p>Use this code to finish creating your workspace:</p>
       <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:18px 0">${otp}</p>
       <p style="color:#6b7085">The code expires in 10 minutes.</p>`,
    ),
  })
}

export async function verifySignup(verificationId: string, otp: string, planCode?: string) {
  if (!otpRequired()) throw otpDisabled()
  const v = await prisma.emailVerification.findUnique({ where: { id: verificationId } })
  if (!v || v.verifiedAt) throw new AppError("NOT_FOUND", "This signup request is no longer valid. Please start again.")
  if (v.expiresAt < new Date()) throw new AppError("BUSINESS_RULE", "The code has expired. Request a new one.")
  if (v.attempts >= MAX_OTP_ATTEMPTS) throw new AppError("RATE_LIMITED", "Too many wrong codes. Request a new one.")
  if (sha256(otp) !== v.otpHash) {
    await prisma.emailVerification.update({ where: { id: v.id }, data: { attempts: { increment: 1 } } })
    throw new AppError("VALIDATION_ERROR", "That code is not correct", { fields: { otp: "Incorrect code" } })
  }
  if (await prisma.user.findUnique({ where: { email: v.email }, select: { id: true } }))
    throw new AppError("CONFLICT", "An account with this email already exists. Try signing in.")

  return createWorkspace(v, planCode, v.id)
}

type WorkspaceOwner = { email: string; companyName: string; ownerName: string; phone: string | null; passwordHash: string }

async function createWorkspace(v: WorkspaceOwner, planCode?: string, verificationId?: string) {
  const { company, owner } = await prisma.$transaction(
    async (tx) => {
      if (verificationId) await tx.emailVerification.update({ where: { id: verificationId }, data: { verifiedAt: new Date() } })
      return provisionCompany(tx, {
        companyName: v.companyName,
        email: v.email,
        ownerName: v.ownerName,
        phone: v.phone,
        passwordHash: v.passwordHash,
        planCode,
      })
    },
    { timeout: 20_000 },
  )
  await prisma.user.update({ where: { id: owner.id }, data: { lastLoginAt: new Date() } })
  await issueSession("user", owner.id, { cid: company.id })
  void sendMail({
    to: v.email,
    subject: "Welcome to TexonPOS",
    text: `Your workspace "${company.name}" is ready. Sign in any time at ${appUrl()}/login`,
    html: layout(
      `Welcome, ${escapeHtml(v.ownerName)}!`,
      `<p>Your workspace <b>${escapeHtml(company.name)}</b> is ready with a Head Office branch and default roles.</p>
       <p><a href="${appUrl()}/app" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open dashboard</a></p>`,
    ),
  }).catch(() => {})
  return { companyId: company.id }
}

// ───────── Login (NFR-SEC-05 lockout) ─────────

let dummy: Promise<string> | null = null
const dummyHash = () => (dummy ??= hashPassword("timing-parity-placeholder"))

const INVALID = () => new AppError("UNAUTHENTICATED", "Incorrect email or password")

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { company: { select: { status: true } } },
  })
  if (!user) {
    await verifyPassword(password, await dummyHash()) // keep timing similar for unknown emails
    throw INVALID()
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    throw new AppError("RATE_LIMITED", `Account locked after repeated failed attempts. Try again in ${mins} minute(s).`)
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1
    await prisma.user.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED_LOGINS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: failed },
    })
    throw INVALID()
  }
  if (user.status !== "active") throw new AppError("FORBIDDEN", "Your account has been deactivated. Contact your administrator.")
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } })
  await issueSession("user", user.id, { cid: user.companyId })
  return { userId: user.id }
}

export async function loginAdmin(email: string, password: string) {
  const admin = await prisma.platformAdmin.findUnique({ where: { email: email.toLowerCase() } })
  if (!admin) throw INVALID()
  if (admin.lockedUntil && admin.lockedUntil > new Date())
    throw new AppError("RATE_LIMITED", "Account temporarily locked after repeated failed attempts.")
  if (!(await verifyPassword(password, admin.passwordHash))) {
    const failed = admin.failedLogins + 1
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: failed >= MAX_FAILED_LOGINS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: failed },
    })
    throw INVALID()
  }
  if (admin.status !== "active") throw new AppError("FORBIDDEN", "This admin account is disabled.")
  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } })
  await issueSession("admin", admin.id)
}

// ───────── Password reset (AUTH-04) ─────────

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || user.status !== "active") return // never reveal whether an email exists
  const token = randomToken(32)
  await prisma.passwordResetToken.create({
    data: { subjectType: "user", subjectId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  })
  const link = `${appUrl()}/reset-password?token=${token}`
  await sendMail({
    to: user.email,
    subject: "Reset your TexonPOS password",
    text: `Hi ${user.name},\n\nReset your password using this link (valid for 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: layout(
      "Reset your password",
      `<p>Hi ${escapeHtml(user.name)},</p><p>Click the button below to choose a new password. The link is valid for 1 hour.</p>
       <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>`,
    ),
  })
}

export async function resetPassword(token: string, password: string) {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } })
  if (!row || row.usedAt || row.expiresAt < new Date() || row.subjectType !== "user")
    throw new AppError("BUSINESS_RULE", "This reset link is invalid or has expired. Request a new one.")
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.subjectId },
      data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ])
  await revokeAllSessions("user", row.subjectId)
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}
