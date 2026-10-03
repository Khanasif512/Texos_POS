# TexonPOS

Multi-tenant import, inventory & POS SaaS (Next.js 16 + Prisma 7 + MySQL).

- Requirements: `docs/GK_Interior_POS_SaaS_SRS.pdf`
- Build brief & decisions: `docs/MASTER_PROMPT.md`
- Phase plan & progress: `docs/PLAN.md`

## Getting started

```bash
cp .env.example .env        # fill DATABASE_URL and secrets
yarn install
yarn db:migrate             # apply migrations
yarn db:seed                # plans, permissions, super admin, demo tenant
yarn dev
```

Demo logins (local only) are defined in `prisma/seed.ts` and `.env` (`SUPER_ADMIN_*`).

## Scripts

`yarn dev` · `yarn build` · `yarn lint` · `yarn typecheck` · `yarn test` · `yarn db:studio`
