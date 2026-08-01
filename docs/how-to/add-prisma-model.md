---
diataxis: how-to
use_when: Add or change a Prisma model / field
audience: agent
related_docs:
  - docs/reference/domain.md
related_code:
  - backend/prisma/schema.prisma
---

# Add a Prisma model or field

Hub: [docs/README.md](../README.md).

1. Edit `backend/prisma/schema.prisma`.
2. `cd backend && npx prisma migrate dev --name <description>`.
3. Update [docs/reference/domain.md](../reference/domain.md) if relationships or meaning changed.
4. Update [docs/meta/code-map.md](../meta/code-map.md) if a new primary code entry appears.
5. Same-chunk docs update per skill `docs-sync-during-work`.

**Production / Docker:** apply existing migrations with `npx prisma migrate deploy` (see [scripts.md](../reference/scripts.md)) — not `migrate dev`.
