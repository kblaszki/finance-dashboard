---
diataxis: how-to
use_when: Export user data or inspect audit logs
audience: both
related_docs:
  - docs/reference/api.md
  - docs/how-to/private-deploy.md
related_code:
  - backend/src/dataExport.ts
  - backend/src/auditLog.ts
  - backend/src/routes/exportRoutes.ts
---

# Data export and audit log

Hub: [docs/README.md](../README.md).

## Full export

1. UI: `/settings` — `DataAutomationSection`.
2. `GET /api/export/full?format=json` — user-scoped JSON bundle (`formatVersion: 2`).
3. Use for backup before risky migrations; also see `npm run db:backup` in [private-deploy.md](private-deploy.md).

## Audit log

1. Same settings UI section.
2. `GET /api/audit-logs` — recent create/update/delete snapshots.
3. Entity types: `transaction`, `asset_trade`, `internal_transfer`, `import_batch` ([domain enums](../reference/domain.md#domain-enums-code-constants)).

| Area | Path |
|------|------|
| Domain | `dataExport.ts`, `auditLog.ts` |
| Client | `exportApi.ts` |
| UI | `SettingsPage` / `DataAutomationSection` |
