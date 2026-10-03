# Brief for parallel module agents

Several agents build different TexonPOS modules **at the same time in the same working tree**.
Read `docs/MASTER_PROMPT.md` (architecture), the SRS text for your module, and study the existing
code before writing anything. Match the existing style exactly — it is the quality bar.

## Hard rules (collisions break everyone's work)

1. **Only create/edit files inside the paths your task lists as yours.** If you need a change elsewhere
   (shared component, nav, schema, another module), do NOT make it — list it under "Requests" in your final report.
2. **Never edit:** `prisma/schema.prisma`, migrations, `package.json`, `yarn.lock`, `src/components/ui/*`,
   `src/components/app/nav-config.ts`, `src/server/db.ts`, `src/server/auth/*`, `src/server/route.ts`, `src/server/api.ts`,
   `src/server/modules/inventory/stock.ts`, `src/server/modules/ledger/service.ts`, `src/server/modules/common/sequence.ts`,
   `docs/PLAN.md`, `prisma/seed.ts`. No `yarn add`, no `prisma migrate`, no `prisma generate`.
3. **No git commands that change state** (no commit, stash, checkout, reset). The coordinator commits.
4. **Do not run `yarn build` or start/stop the dev server.** A dev server is already running at http://localhost:3000.
5. Verify with `yarn -s tsc --noEmit 2>&1 | grep -E "<your paths>"` (other agents' half-done files may show errors — ignore those,
   but your files must be error-free), `yarn -s eslint <your files>`, and `yarn -s vitest run tests/<your tests>`.
   Smoke-test your APIs with curl against localhost:3000 using your own cookie jar in your scratch/temp dir:
   `curl -c jar -X POST localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"owner@gkinterior.test","password":"Demo@12345"}'`
   (local demo tenant from prisma/seed.ts). Data you create in the demo tenant is fine; keep it realistic (it doubles as demo data).
6. On Windows Git Bash, long chains of heredocs fail to parse — create files with the Write tool.

## Building blocks you must use (do not re-implement)

- **Tenant routes:** `tenantRoute({ perm, feature }, async ({ req, ctx, db, params }) => ...)` from `@/server/route`;
  `db` is tenant-scoped (companyId injected). Inside `prisma.$transaction(async (tx) => …)` use the raw `prisma` client from
  `@/server/db` and pass `companyId: ctx.companyId` explicitly; verify ownership of every id first.
- **Envelope / validation:** `ok`, `parseBody`, `listParams` from `@/server/api`; errors from `@/server/errors`
  (`AppError`, `businessRule`, `notFound`, `forbidden`). zod schemas live in `src/lib/validation/<module>.ts` (client-safe).
- **Authorization:** `can`, `requirePermission`, `assertBranch`, `branchFilter`, `assertFeature` (`@/server/auth/context`).
  Pages: `const ctx = await requireTenant("/app/…"); ensurePermission(ctx, "x.y")`. Always scope branch data with
  `branchFilter(ctx, requested)` / `assertBranch`. Hide cost prices unless `can(ctx, "inventory.view_cost")`.
- **Money:** `dec`, `sum`, `round2`, `round4`, `num` from `@/server/decimal`. Never do money math with JS numbers on the server.
  Convert Decimals with `num()` before passing to client components.
- **Stock:** `receiveStock`, `issueStockFIFO`, `restoreToBatches`, `lastUnitCost` from `@/server/modules/inventory/stock`.
  Every stock movement goes through these (INV-04).
- **Ledgers:** `postCustomerLedger`, `postSupplierLedger` from `@/server/modules/ledger/service` (read the sign conventions).
- **Numbers:** `nextNumber(tx, { companyId, key, branchId, branchCode })` from `@/server/modules/common/sequence`.
  Keys: INV, CH, MR, SR, CN, QT, SO, PO, GRN, ADJ, TRF, EXP, SP, CL; customer `CUS` / supplier `SUP` with `yearly: false`.
- **Audit:** `audit(ctx, {...}, tx)` from `@/server/audit` on every financial create/update/delete (AUD-01).
- **Idempotency:** wrap invoice/receipt/LC-finalize/payment POSTs with `idempotent(req, ctx.companyId, route, fn)` from `@/server/idempotency`;
  clients send an `Idempotency-Key` header (`api.post(url, body, { idempotencyKey })`, generate with `crypto.randomUUID()` once per form).
- **Lists:** big lists = server pages reading `searchParams` with `readListParams` / `dateRange` (`@/server/list`) and rendering
  `ServerTable` (`@/components/shared/server-table`) plus `BranchFilter`, `DateRangeFilter`, `SelectFilter` (`@/components/shared/filters`).
  Small lists may use `DataTable`.
- **Pickers:** `VariationPicker`, `CustomerPicker`, `SupplierPicker`, `LcPicker` (`@/components/shared/pickers`).
- **UI kit:** `PageBody`, `PageHeader` (`@/components/app/page-header`), `EmptyState`, `StatusBadge`/`ActiveBadge`, `StatCard`, `Field`,
  shadcn components in `@/components/ui`, `useApp`/`useCan` (`@/components/app/app-context`), `api` + `applyFieldErrors` + `errorMessage`
  (`@/lib/api-client`), formatting `money`, `quantity`, `date`, `dateTime` (`@/lib/format`), toasts via `sonner`.
  Forms: react-hook-form + zodResolver with `useForm<z.input<S>, unknown, z.output<S>>`. See `src/components/org/*` for patterns.
- **Printing:** printable pages live under `src/app/print/...` (bare layout, no app shell, so `useApp` is unavailable there) and use
  `PrintToolbar` + `PrintSheet` (`@/components/shared/print-toolbar`).
- Route params / searchParams are Promises in this Next.js version (`await params`). Middleware is `src/proxy.ts`.

## Quality bar

Professional, dense-but-calm UI consistent with existing pages; every screen has loading/empty/error states, works at 360px width
and in dark mode; destructive actions confirm; numbers use the `num` class (tabular). Server enforces every rule — the UI only hides.
Write vitest tests for any non-trivial calculation in `tests/<module>.test.ts`.

## Final report (your last message)

1. Files created/changed. 2. What works, how you verified it (commands + results). 3. Anything not done / known gaps.
4. **Requests** for the coordinator (shared-file changes, schema changes, nav changes) with exact proposed diffs.
