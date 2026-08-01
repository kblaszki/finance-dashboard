---
diataxis: reference
use_when: CLI scripts and prisma migrate deploy
audience: both
related_code:
  - backend/src/scripts/createUser.ts
  - backend/src/scripts/backupDb.ts
  - backend/prisma/seed.ts
---

# Scripts reference

Hub: [docs/README.md](../README.md).

Run from `backend/` unless noted.

| Script | Command | Purpose |
|--------|---------|---------|
| Create user | `npm run create-user -- --email … --username … --password …` | Private deploy when registration is closed; seeds default categories |
| Demo user seed | `npm run db:seed` | Upsert login-only `demo@finance.local` + default categories if missing (no portfolio) |
| DB backup | `npm run db:backup` | Copy SQLite file (optional `--gzip` / `BACKUP_GZIP`) |
| Migrate deploy | `npx prisma migrate deploy` | Apply migrations (CI / production) |
| Migrate dev | `npx prisma migrate dev --name <description>` | Local schema change |
| Dev server | `npm run dev` | `ts-node-dev` API |
| Build | `npm run build` | `tsc` |

Root: `npm run dev` runs backend + frontend; `npm test` / `npm run test:coverage` — [testing.md](testing.md).
