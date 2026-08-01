---
diataxis: tutorial
use_when: Create login-only demo user
audience: both
related_docs:
  - docs/tutorials/first-run.md
related_code:
  - backend/prisma/seed.ts
---

# Tutorial: demo user seed

Goal: upsert a demo account you can log into. **No sample portfolio data** — auth baseline only.

## Steps

1. Ensure migrations are applied (`cd backend && npx prisma migrate dev` if needed).
2. Run:

```bash
cd backend
npm run db:seed
```

3. Log in: `demo@finance.local` / `demo12345` (username: `demo`).

## Notes

- Seed upserts email/username/password only (`backend/prisma/seed.ts`).
- Safe to re-run; it resets the demo password hash to the known value.
- More detail: [README.md](../../README.md) (Demo user section). Hub: [docs/README.md](../README.md).
