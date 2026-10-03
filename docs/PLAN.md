# TexonPOS — Implementation Plan

Status legend: ✅ done · 🚧 in progress · ⏳ pending

| # | Phase | Scope | Status |
|---|---|---|---|
| 0 | Foundation & public site | Next.js + Prisma + MySQL scaffold, full DB schema, design system, marketing pages (home, features, pricing, about, contact, legal) | ✅ |
| 1 | Identity & tenancy | Email+OTP signup (TEN-01), login/refresh/logout, password reset, RBAC + seeded roles, tenant context, app shell, branches, employees, roles UI, super admin login + tenants list | ✅ |
| 2 | Master data | Suppliers (+ledger view), product categories/products/variations (INV-01), customers with credit limit & opening balance (CRM-01..03), units | ✅ |
| 3 | LC & purchasing | LC CRUD + status flow (LC-10), cost items (LC-02), cost-distribution engine weight/qty + compare (LC-04/05) with tests on SRS §8 example, snapshots (LC-06/07), POs (PO-01..03), goods receipt → batches + stock ledger, adjustments (INV-05), branch transfers | ✅ |
| 4 | Sales & POS | POS screen (cash/credit), FIFO deduction (SLS-02), invoice/challan print + print status (SLS-03/08), money receipts & advances (SLS-04), quotations/orders + cancel (SLS-07), invoice cancel (SLS-05), returns with approval + credit notes (SLS-06) | ✅ |
| 5 | Finance & expenses | Expense categories/entries, LC-linked delivery charges (DLV-01, LC-09, EXP-02), supplier payments/AP (FIN-03), daily cash closing (FIN-01), P&L (FIN-02), dashboard KPIs | ⏳ |
| 6 | Reports | All 16 reports of SRS §4.13 with date/branch filters, Excel + PDF export | ⏳ |
| 7 | SaaS commercialisation | Plans/feature flags/limits enforcement (TEN-02..05), trial expiry & read-only lock, billing invoices, super admin: plans, tenant override/suspend/extend, impersonation (audited), MRR/churn/conversion analytics | ⏳ |
| 8 | Polish | Bengali i18n, notifications (low stock, LC arrival, overdue credit, renewal), audit-log UI, perf indexes, backups doc | ⏳ |

## Phase 0 checklist
- [x] Scaffold Next.js 16 (TS, Tailwind v4, App Router, src/) with yarn
- [x] shadcn/ui init + brand tokens (light/dark)
- [x] Prisma 7 + MariaDB adapter, `.env`, full schema, first migration
- [x] Seed: permissions, plans, super admin, demo tenant
- [x] Marketing layout (header/footer) + home, features, pricing, about, contact, legal pages
- [x] git init, `dev` branch, commit

## Phase 1 checklist
- [x] jose JWT access/refresh, cookie helpers, `proxy.ts` route guard
- [x] Signup → OTP email → verify → company + owner + Head Office + system roles + trial subscription
- [x] Login (lockout after 5 failures, NFR-SEC-05), logout, forgot/reset password
- [x] TenantContext, `tenantDb`, `requirePermission`, API envelope helpers
- [x] App shell (sidebar per Appendix A, branch switcher, user menu, theme toggle)
- [x] Dashboard placeholder with KPIs
- [x] Branches CRUD (plan limit), Employees CRUD (branch assignment, deactivate), Roles & permission matrix editor
- [x] Company profile settings
- [x] Super admin: login, overview, tenants list/detail, suspend/reactivate, extend trial

## Phase 2 checklist
- [ ] Suppliers CRUD + opening balance → supplier ledger, list with payable totals (SUP-01/02)
- [ ] Categories, products, variations (SKU/barcode/weight/price/reorder) with server-side paginated table (INV-01)
- [ ] Customers CRUD with type, credit limit, opening balance (advance or due) → customer ledger (CRM-01..03)
- [ ] Customer & supplier detail pages with ledger history
- [ ] Generic server-paginated list API helper + table component
