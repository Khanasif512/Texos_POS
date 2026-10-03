# TexonPOS — Master Build Prompt (v2, refined)

> Source of truth for business rules: `GK_Interior_POS_SaaS_SRS.pdf` (SRS v1.0).
> This file overrides the SRS **only** on stack/architecture choices and fills its gaps.
> Requirement IDs (LC-04, SLS-02, …) refer to the SRS.

## 1. What we are building

**TexonPOS** — a multi-tenant SaaS for import → inventory → sales businesses
(first tenant: GK Interior, Bangladesh; aluminium, glass, home decor from China).
Three surfaces in **one Next.js project**:

| Surface | Path | Audience |
|---|---|---|
| Public marketing site | `/`, `/features`, `/pricing`, `/about`, `/contact`, `/legal/*` | Prospects |
| Tenant app | `/app/*` | Company owner, managers, staff |
| Super Admin portal | `/admin/*` | Platform operator (Texon) |

Auth pages: `/signup`, `/verify`, `/login`, `/forgot-password`, `/reset-password`, `/admin/login`.

## 2. Stack (replaces SRS §2.4)

- **Next.js 16** App Router, TypeScript strict, `src/` layout. Frontend + backend in one app.
- **MySQL 8** via **Prisma 7** (`prisma-client` generator + `@prisma/adapter-mariadb`). Migrations only — no manual schema edits.
- **Yarn** (classic) as package manager; `npx` for one-off CLIs.
- **Tailwind CSS v4 + shadcn/ui** (customised tokens — never default look), `lucide-react` icons, `recharts` for charts.
- **Auth:** custom JWT with `jose` — access token (15 min) + rotating refresh token (30 days, hashed in DB) in httpOnly cookies (AUTH-01). `bcryptjs` hashing. Separate cookie + table for platform admins.
- **Validation:** `zod` on every input (shared by forms and API).
- **Forms/data:** `react-hook-form`, TanStack Query for client lists, Server Components for first paint.
- **Money:** `DECIMAL(15,2)` BDT, `DECIMAL(15,4)` foreign amounts, `DECIMAL(15,6)` FX rate; `Prisma.Decimal` in code — never JS floats for money.
- **Email:** `nodemailer` (SMTP from env). In dev, emails/OTPs are logged to the server console.
- **Exports:** `exceljs` (Excel) + print-optimised HTML / `@react-pdf/renderer` (PDF).
- **Tests:** `vitest` — mandatory for the LC cost engine, FIFO, ledgers.

## 3. Architecture rules

```
src/
  app/(marketing)/…     public site            app/(auth)/…   signup/login
  app/app/…             tenant app             app/admin/…    super admin
  app/api/v1/…          REST route handlers (SRS §3.3 envelope)
  server/               ← all business logic, never imported by client code
    db.ts               prisma client + tenant-scoped extension
    auth/               jwt, session, password, rbac guard
    modules/<module>/   service.ts (logic) · schema.ts (zod) · repo helpers
  components/ui         shadcn primitives     components/<area>  composed UI
  lib/                  client-safe utils (format, money, cn)
```

1. **Tenant isolation (NFR-SEC-01):** every tenant table has `companyId`. Services receive a
   `TenantContext {companyId, userId, branchIds, permissions, allBranches}` built from the
   verified JWT — never from request input. Use `tenantDb(ctx)` (Prisma extension that injects
   `companyId` into every where/create) for tenant models.
2. **RBAC (AUTH-03/05):** permission keys `module.action` (e.g. `lc.update`, `sales.create`).
   Every route handler / server action calls `requirePermission(ctx, key)` and
   `assertBranch(ctx, branchId)`. UI hides, server enforces.
3. **Plan gating (TEN-03):** `assertFeature(ctx, 'lc')` / `assertLimit(ctx, 'branches')` server-side.
4. **API envelope:** `{success, data, message, meta}` / `{success:false, error:{code,message,details}}`.
   Lists: `?page&limit&sort=field:asc&q&from&to&branchId`.
5. **Transactions (NFR-AVL-02):** invoice confirm, goods receipt, LC finalisation, returns,
   receipts → one `prisma.$transaction`. Idempotency key header on these mutations.
6. **Ledgers are append-only:** stock (`StockLedgerEntry`), customer, supplier. Balances derive from ledgers; quantities are never edited directly (INV-04).
7. **Audit (AUD-01):** financial entities write `AuditLog {who, entity, action, before, after}`.
8. **Numbering:** per-branch sequences (`INV-DHK-2026-000123`) via a `Sequence` table locked in-transaction.

## 4. Design system ("professional, sophisticated" — NFR-UX-01)

- Brand: deep indigo/ink primary, teal accent, neutral slate surfaces; light + dark themes.
- Typography: Inter (UI) + a display face for marketing headlines; tabular numerals for money.
- Dense but airy data tables (sticky header, search/filter/sort/paginate — NFR-UX-04).
- App shell: collapsible sidebar grouped per SRS Appendix A, top bar with branch switcher,
  global search (⌘K), user menu. POS screen: keyboard-first, full-height, cart on the right.
- Every list has empty state, loading skeleton, error state. Every destructive action confirms.
- Bangladesh formats: `৳ 1,23,456.00` (lakh grouping), `dd MMM yyyy`; Bengali labels in Phase 8.

## 5. Gaps in the SRS — decisions taken

| Gap | Decision |
|---|---|
| Stack says React+Express | One Next.js app; route handlers = Express API; same layering. |
| Exchange-rate stage | Rate stored on LC; base cost recomputed at finalisation with final rate. |
| Extra-cost rounding | Distribute to 2 dp; residue (±0.01s) added to the largest line so the sum is exact (LC-04 acceptance). Per-unit cost kept at 4 dp internally. |
| Cost items allocated from expenses (EXP-02) | Expense with `lcId` + `allocateToLc=true` creates a linked `LCCostItem`. |
| Returns need admin approval (Appendix A) | `SalesReturn.status = pending → approved/rejected`; stock/ledger posts on approval. |
| Advance payment (Appendix A) | Money receipt without invoice → negative customer balance (advance), auto-applied on later credit invoices. |
| Credit-limit override (CRM-01) | Permission `sales.override_credit_limit`; override logged in audit. |
| Payment gateway | `BillingProvider` interface; v1 ships `manual` provider (super admin marks paid). |
| Cash payouts in FIN-01 | Supplier payments + cash refunds in cash method. |

## 6. Definition of done (per phase)

- `yarn lint && yarn typecheck && yarn test && yarn build` pass.
- Migrations committed; seed script updated (`yarn db:seed` → demo tenant "GK Interior" + super admin).
- Every new screen responsive (≥360px), dark-mode correct, empty/loading/error states present.
- Server-side permission + tenant checks on every new endpoint.
- One commit per finished phase on `dev`.
