# TEST_EMS Backend (Phase 2a)

Local development foundation for TEST_EMS.

**Phase 2a backend foundation implemented for local testing. Physical gateway integration, production telemetry ingestion and hardware verification are NOT completed.**

## Stack

- Node.js + Fastify + TypeScript (strict)
- MySQL 8.x (InnoDB, utf8mb4)
- REST (read-only operational APIs)
- Zod validator for `testems.telemetry.v1` (library only — **no ingest route**)

## Quick start

```bash
cd B:\TEST_EMS\backend
cp .env.example .env   # then set local MySQL credentials
npm install
npm run migrate
npm run seed:catalogue
npm run dev
```

Server binds to `127.0.0.1:3001` by default.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run migrate` | Apply versioned SQL migrations (checksum + lock) |
| `npm run seed:catalogue` | Seed site + 4 loads + placeholder meters/gateway |
| `npm run seed:demo-telemetry` | Explicit DEMO samples only (refuses REAL) |
| `npm test` | Unit + MySQL integration tests |
| `npm run typecheck` | `tsc --noEmit` |

## API routes (Phase 2a)

| Method | Path |
|--------|------|
| GET | `/health/live` |
| GET | `/health/ready` |
| GET | `/api/v1/sites` |
| GET | `/api/v1/sites/:siteId` |
| GET | `/api/v1/sites/:siteId/overview` |
| GET | `/api/v1/overview` |
| GET | `/api/v1/loads` |
| GET | `/api/v1/loads/:loadId` |
| GET | `/api/v1/analytics/energy` |
| GET | `/api/v1/analytics/demand` |
| GET | `/api/v1/analytics/billing` |
| GET | `/api/v1/analytics/aggregate-pf` |

**Not registered:** `POST /api/v1/ingest/telemetry`

## Trust boundary

- Operational APIs hard-filter `source_type = 'REAL'`.
- `origin_assurance: "LABEL_ONLY"` — not gateway-authenticated, not hardware-verified.
- Empty REAL → `data_state: "NO_DATA"` with null measurements.
- No LIVE / STALE / OFFLINE emission in Phase 2a.

## Migrations

See `migrations/`:

1. `001_schema_migrations_bootstrap.sql`
2. `002_core_catalogue.sql`
3. `003_telemetry_samples.sql`
