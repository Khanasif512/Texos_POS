/** Before/after diff for audit entries (client-safe, pure). */

export type DiffRow = { path: string; before: string | undefined; after: string | undefined; changed: boolean }

const MAX_DEPTH = 4

function flatten(v: unknown, prefix: string, out: Map<string, string>, depth: number) {
  if (v !== null && typeof v === "object" && depth < MAX_DEPTH) {
    const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x] as const) : Object.entries(v as Record<string, unknown>)
    if (entries.length === 0) out.set(prefix || "(value)", Array.isArray(v) ? "[]" : "{}")
    for (const [k, x] of entries) flatten(x, prefix ? (Array.isArray(v) ? `${prefix}[${k}]` : `${prefix}.${k}`) : k, out, depth + 1)
    return
  }
  out.set(prefix || "(value)", v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v))
}

/** Flattens both sides to dotted paths and marks the keys whose values differ. */
export function diffJson(before: unknown, after: unknown): DiffRow[] {
  const b = new Map<string, string>()
  const a = new Map<string, string>()
  if (before != null) flatten(before, "", b, 0)
  if (after != null) flatten(after, "", a, 0)
  const keys = [...new Set([...b.keys(), ...a.keys()])]
  return keys.map((path) => {
    const bv = b.get(path)
    const av = a.get(path)
    return { path, before: bv, after: av, changed: before != null && after != null ? bv !== av : true }
  })
}

export const humanize = (s: string) => {
  const t = s.replace(/[._]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
