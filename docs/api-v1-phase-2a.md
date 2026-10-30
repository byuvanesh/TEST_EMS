# TEST_EMS API v1 — Phase 2a

Base URL (local): `http://127.0.0.1:3001`

All operational measurement routes are **REAL-labelled only** with `origin_assurance: "LABEL_ONLY"`.  
They are **not** gateway-authenticated and **not** hardware-verified.

## Routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health/live` | Process up |
| GET | `/health/ready` | DB ping; no secrets in body |
| GET | `/api/v1/sites` | Catalogue |
| GET | `/api/v1/sites/:siteId` | 404 if missing |
| GET | `/api/v1/sites/:siteId/overview` | NO_DATA when no REAL samples |
| GET | `/api/v1/overview` | First site convenience |
| GET | `/api/v1/loads` | Optional `?siteId=` |
| GET | `/api/v1/loads/:loadId` | Null measurements when empty |
| GET | `/api/v1/analytics/energy` | `availability: UNAVAILABLE` |
| GET | `/api/v1/analytics/demand` | `availability: UNAVAILABLE` |
| GET | `/api/v1/analytics/billing` | `availability: UNAVAILABLE` |
| GET | `/api/v1/analytics/aggregate-pf` | `availability: UNAVAILABLE` |

**Not registered:** `POST /api/v1/ingest/telemetry`

## Data states (Phase 2a)

- `NO_DATA` — no REAL-labelled telemetry for the load/site scope  
- `UNKNOWN` — REAL sample exists; freshness not evaluated (R037 open)  
- Do **not** emit `LIVE`, `STALE`, or `OFFLINE`

## Errors

```json
{ "error": { "code": "SITE_NOT_FOUND", "message": "..." } }
```

`source_type=DEMO` on operational routes → `400 DEMO_NOT_ALLOWED`.
