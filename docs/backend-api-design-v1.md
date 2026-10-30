# TEST_EMS Backend API Design v1

**Status:** PROPOSED  
**Stack:** Node.js + Fastify + TypeScript + MySQL + REST (**PROPOSED**, not confirmed)  
**Implementation:** Not started — design only  

Related: [telemetry-contract-v1.md](telemetry-contract-v1.md), [database-design-v1.md](database-design-v1.md), [phase-1.5-architecture-audit.md](phase-1.5-architecture-audit.md)

---

## 1. Service boundaries

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Ingest Service  │────▶│ Persistence      │◀────│ Query / Read API│
│ (auth: gateway) │     │ (MySQL)          │     │ (auth: user)    │
└─────────────────┘     └────────┬─────────┘     └────────▲────────┘
                                 │                        │
                        ┌────────▼─────────┐     ┌────────┴────────┐
                        │ Derivation Worker│     │ Alarm Service   │
                        │ (energy, cover.) │     │ (eval + ack)    │
                        └──────────────────┘     └─────────────────┘
```

| Service | Responsibility | Class |
|---------|----------------|-------|
| **Ingest** | Validate telemetry contract; idempotent insert; update `device_comm_status` | PROPOSED |
| **Derivation** | Counter deltas, rollups, coverage; never invent raw samples | DERIVED logic |
| **Query API** | SPA endpoints mirroring current page DTOs | PROPOSED |
| **Alarm** | Threshold eval (**after** limits TBD); acknowledge; history | PROPOSED / TBD limits |
| **Config / Admin** | Loads, meters, gateways, settings; audit | PROPOSED |
| **Auth** | Sessions / JWT / IdP — policy TBD | TBD |

Keep **DEMO** generators in frontend **or** a backend `DemoFixture` module — never in Derivation’s REAL path.

---

## 2. Cross-cutting conventions

| Topic | Proposal | Class |
|-------|----------|-------|
| Base path | `/api/v1` | PROPOSED |
| Time | UTC in JSON; UI converts to IST | PROPOSED |
| Errors | `{ "error": { "code", "message", "details?" } }` | PROPOSED |
| Pagination | `cursor` or `limit`/`offset` — prefer cursor for samples | PROPOSED |
| Source scope | Query param `source_type=REAL\|DEMO` default **REAL** | PROPOSED |
| Validation | Fastify JSON Schema / TypeBox / Zod at boundary | PROPOSED |
| Auth header (user) | `Authorization: Bearer …` | TBD mechanism |
| Auth header (gateway) | `X-Gateway-Id` + `X-Gateway-Key` or mTLS | TBD |

Every read DTO that surfaces measurements includes:

```ts
data_state: 'LIVE' | 'STALE' | 'OFFLINE' | 'DEMO'
source_type: 'REAL' | 'DEMO'
as_of: string // ISO UTC
```

---

## 3. Ingest routes

### `POST /api/v1/ingest/telemetry`

- **Auth:** gateway credential  
- **Body:** [telemetry-contract-v1](telemetry-contract-v1.md) envelope  
- **Behaviour:** validate → dedupe on `(gateway, meter, sequence, source_type)` → insert RAW → touch comm status → enqueue derivation (async)  
- **Response 202/200:** `{ "accepted": n, "duplicates": n, "received_at": "..." }`  

### `POST /api/v1/ingest/heartbeat` (optional)

Gateway liveness without samples — **TBD**.

---

## 4. Read API routes (SPA)

Mapped to current frontend pages.

### 4.1 Site / shell

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sites/:siteId` | Site name, timezone |
| GET | `/api/v1/sites/:siteId/health` | Global data_state, alarm counts, gateway summary |

### 4.2 Overview

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sites/:siteId/overview` | KPIs, loads[], power_series, top alarms, gateway — replaces `getOverviewData()` |

KPI computation: **server-side DERIVED** (not frontend sum of demo kW).

### 4.3 Loads

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sites/:siteId/loads` | Catalogue (from DB, not mock file) |
| GET | `/api/v1/loads/:loadId` | Detail + latest electrical + capabilities |
| GET | `/api/v1/loads/:loadId/timeseries` | Query: `from`,`to`,`metric`,`resolution` |

### 4.4 Energy analytics

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sites/:siteId/energy/analytics` | Query: `period` or `from`/`to`, `load_id` \| `all` → `EnergyAnalyticsResult`-shaped JSON |
| GET | `/api/v1/sites/:siteId/energy/export.csv` | Same filters; CSV |

**Important:** REAL analytics use counter-delta algorithm version documented in open decisions — **not** `energyAnalytics.ts` demo hourly sum.

### 4.5 Alarms

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sites/:siteId/alarms` | Query: `tab`, `severity`, `load_id`, `type`, `status` |
| GET | `/api/v1/alarms/:alarmId` | Detail |
| POST | `/api/v1/alarms/:alarmId/acknowledge` | Body: optional comment; actor from auth — **does not clear device** |
| GET | `/api/v1/alarms/:alarmId/transitions` | History |

### 4.6 System / devices

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/sites/:siteId/system` | Aggregated System page DTO with certainty labels |
| GET | `/api/v1/sites/:siteId/gateways` | Status unknown until verified |
| GET | `/api/v1/sites/:siteId/meters` | Assignments; null CT/slave shown as not configured |
| PATCH | `/api/v1/meters/:id` | Admin only — still no invented defaults |
| GET/PATCH | `/api/v1/sites/:siteId/config` | Settings with certainty metadata |

### 4.7 Auth (stub until policy confirmed)

| Method | Path | Purpose | Class |
|--------|------|---------|-------|
| POST | `/api/v1/auth/login` | | TBD |
| POST | `/api/v1/auth/logout` | | TBD |
| GET | `/api/v1/auth/me` | | TBD |

---

## 5. Validation strategy

| Layer | Tooling (PROPOSED) | Checks |
|-------|-------------------|--------|
| HTTP boundary | Fastify schema | Types, required fields, enums, max body size |
| Domain | Service validators | FK existence, source_type policy, period range caps |
| Ingest | Contract v1 rules | sequence, skew, duplicate, capability consistency |
| Derivation | Pure functions + tests | Counter delta, rollover detect, coverage; **unit tests mandatory** |
| Config writes | Certainty-aware | Reject storing fabricated “confirmed” register maps |

---

## 6. Index / query expectations

Energy page “This Month” should hit `derived_*` tables, not full raw scan.  
Overview “last 24 h” may use raw or 1-min rollups — **TBD** with poll interval.

Indexes: see [database-design-v1.md](database-design-v1.md) §2.8–2.11.

---

## 7. Mapping from current frontend modules

| Frontend today | Phase 2 replacement |
|----------------|---------------------|
| `mock/demoData.getOverviewData` | `GET .../overview` + `DemoOverviewAdapter` fallback |
| `lib/energyAnalytics.buildEnergyAnalytics` | REAL: `EnergyDerivationService`; DEMO: keep or port behind `source_type=DEMO` |
| `lib/alarmFilters` | Keep client-side **or** move filter to query params (prefer server filter for history) |
| `mock/loads` | `GET .../loads` |
| `mock/systemDemoConfig` | `GET .../system` with server-side certainty enums |
| Local alarm acknowledge | `POST .../acknowledge` |

---

## 8. Non-goals for first backend slice

- MQTT (unless decided)  
- PDF reports / tariff cost  
- Live Modbus in Node (belongs on gateway firmware)  
- Claiming RS-485 master works  
- Inventing register maps in seed migrations  

---

## 9. Suggested Phase 2a implementation order

1. Repo `backend/` scaffold + MySQL migrations for sites/loads/gateways/meters/telemetry_samples  
2. Ingest endpoint + contract fixtures (DEMO + synthetic REAL)  
3. Read `GET /loads` + `GET /overview` (empty/partial quality honest)  
4. Derivation v0 **documented** (even if energy returns unavailable until counter VERIFY)  
5. Alarms CRUD/ack against DB  
6. Wire frontend service interface; feature flag `VITE_DATA_MODE=demo|api`
