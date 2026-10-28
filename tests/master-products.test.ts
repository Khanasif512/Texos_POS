import { describe, expect, it } from "vitest"
import { priceRange, productSchema, suggestSku, uniqueSku } from "@/lib/validation/products"
import { supplierSchema } from "@/lib/validation/suppliers"

describe("SKU suggestion", () => {
  it("abbreviates words and keeps numeric tokens", () => {
    expect(suggestSku("Aluminium Profile Type-1", "6-inch profile")).toBe("ALU-PRO-TYP-1-6INC")
    expect(suggestSku("Clear Float Glass", "5mm")).toBe("CLE-FLO-GLA-5MM")
  })
  it("drops stop words and works without a variation", () => {
    expect(suggestSku("Door Handle with Lock")).toBe("DOO-HAN-LOC")
    expect(suggestSku("", "")).toBe("SKU")
  })
  it("makes SKUs unique case-insensitively", () => {
    expect(uniqueSku("ALU-1", [])).toBe("ALU-1")
    expect(uniqueSku("alu-1", ["ALU-1"])).toBe("ALU-1-2")
    expect(uniqueSku("ALU-1", ["ALU-1", "alu-1-2"])).toBe("ALU-1-3")
  })
  it("computes a price range", () => {
    expect(priceRange([])).toBeNull()
    expect(priceRange([450, 1200, 800])).toEqual({ min: 450, max: 1200 })
  })
})

describe("product schema (INV-01)", () => {
  const base = { name: "Aluminium Profile Type-1", unit: "pcs" }
  it("requires at least one variation", () => {
    expect(productSchema.safeParse({ ...base, variations: [] }).success).toBe(false)
  })
  it("normalises variation fields", () => {
    const v = productSchema.parse({
      ...base,
      categoryId: "none",
      variations: [{ name: "6-inch", sku: " alu-6 ", salePrice: "450", wholesalePrice: "", unitWeight: "0.5" }],
    })
    expect(v.categoryId).toBeNull()
    expect(v.variations[0]).toMatchObject({ sku: "ALU-6", salePrice: 450, wholesalePrice: null, unitWeight: 0.5, reorderLevel: 0, status: "active" })
  })
  it("accepts uploaded product image paths and existing external URLs", () => {
    const uploadedPath = `/uploads/products/${"a".repeat(64)}/123e4567-e89b-12d3-a456-426614174000.webp`
    const parse = (imageUrl: string) => productSchema.parse({ ...base, imageUrl, variations: [{ name: "Standard" }] }).imageUrl
    expect(parse(uploadedPath)).toBe(uploadedPath)
    expect(parse("https://example.com/product.png")).toBe("https://example.com/product.png")
    expect(productSchema.safeParse({ ...base, imageUrl: "/uploads/other/file.png", variations: [{ name: "Standard" }] }).success).toBe(false)
  })
  it("rejects duplicate SKUs and variation names within a product", () => {
    const r = productSchema.safeParse({
      ...base,
      variations: [
        { name: "6-inch", sku: "A-1" },
        { name: "6-INCH", sku: "a-1" },
      ],
    })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path.join("."))
    expect(paths).toContain("variations.1.sku")
    expect(paths).toContain("variations.1.name")
  })
})

describe("supplier schema", () => {
  it("defaults currency to RMB and rejects a negative opening payable", () => {
    expect(supplierSchema.parse({ name: "Foshan Glass" }).currency).toBe("RMB")
    expect(supplierSchema.safeParse({ name: "Foshan Glass", openingBalance: -5 }).success).toBe(false)
  })
})
