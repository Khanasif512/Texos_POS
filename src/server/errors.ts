export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PLAN_LIMIT"
  | "FEATURE_LOCKED"
  | "SUBSCRIPTION_INACTIVE"
  | "RATE_LIMITED"
  | "BUSINESS_RULE"
  | "INTERNAL"

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PLAN_LIMIT: 402,
  FEATURE_LOCKED: 402,
  SUBSCRIPTION_INACTIVE: 402,
  RATE_LIMITED: 429,
  BUSINESS_RULE: 400,
  INTERNAL: 500,
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
  get status() {
    return STATUS[this.code]
  }
}

export const notFound = (what = "Record") => new AppError("NOT_FOUND", `${what} not found`)
export const forbidden = (msg = "You do not have permission to do this") => new AppError("FORBIDDEN", msg)
export const businessRule = (msg: string, details?: unknown) => new AppError("BUSINESS_RULE", msg, details)
