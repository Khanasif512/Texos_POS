import { createHash, randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { AppError } from "@/server/errors"
import { ok } from "@/server/api"
import { tenantRoute } from "@/server/route"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_REQUEST_SIZE = 6 * 1024 * 1024

export const runtime = "nodejs"

/** Upload the logo for the authenticated company workspace. */
export const POST = tenantRoute({ perm: "settings.company" }, async ({ req, ctx }) => {
  const contentLength = Number(req.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    throw new AppError("VALIDATION_ERROR", "Image upload must be 5 MB or smaller")
  }
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new AppError("VALIDATION_ERROR", "Upload an image file")
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid image upload")
  }
  const kind = formData.get("kind")
  if (kind !== "logo") throw new AppError("VALIDATION_ERROR", "Choose a logo")
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) throw new AppError("VALIDATION_ERROR", "Choose an image file")
  if (file.size > MAX_FILE_SIZE) throw new AppError("VALIDATION_ERROR", "Image upload must be 5 MB or smaller")

  const bytes = Buffer.from(await file.arrayBuffer())
  let extension: "jpg" | "png" | "webp"
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    extension = "png"
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    extension = "jpg"
  } else if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    extension = "webp"
  } else {
    throw new AppError("VALIDATION_ERROR", "Only PNG, JPEG, and WebP images are supported")
  }

  const tenantFolder = createHash("sha256").update(ctx.companyId).digest("hex")
  const filename = `${randomUUID()}.${extension}`
  const relativePath = path.join("uploads", "companies", tenantFolder, "logo")
  const directory = path.join(process.cwd(), "public", relativePath)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" })

  const url = `/${relativePath.replaceAll(path.sep, "/")}/${filename}`
  return ok({ logoUrl: url }, { status: 201, message: "Company logo uploaded" })
})
