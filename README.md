# TEST_EMS

Industrial Energy Management System — **Phase 0** frontend foundation.

Independent project. Electrical monitoring for four loads. No load control. No invented Modbus maps, CT ratios, or live hardware status.

## Quick start

### Frontend (DEMO UI)

```bash
cd B:\TEST_EMS\frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### Backend (Phase 2a local foundation)

```bash
cd B:\TEST_EMS\backend
cp .env.example .env
npm install
npm run migrate
npm run seed:catalogue
npm run dev
```

API: **http://127.0.0.1:3001** — no production ingest route.

## Stack

| Layer | Choice | Status |
|-------|--------|--------|
| Frontend | React + TypeScript + Vite | Phase 0+1 |
| UI | Tailwind CSS + Lucide + Recharts | Implemented |
| Backend | Node.js + Fastify + TypeScript | **Phase 2a local** |
| Database | MySQL 8 (`test_ems`) | **Phase 2a local** |
| API | REST (read-only ops) | **Phase 2a local** |

## What's implemented (Phase 0 + Phase 1)

- Application shell (sidebar, header, data-state indicator, responsive layout)
- **Overview** with DEMO DATA (KPIs, load cards, 24 h chart, alarms, gateway strip)
- **Energy** analytics: period/load filters, KPIs, charts, comparison, CSV export
- **Alarms**: active/historical tabs, filters, detail drawer, local demo acknowledge
- **System**: labelled PROPOSED / TBD / NOT CONFIGURED / VERIFY configuration sections
- **Load Detail** drill-down (not in main nav)
- Design system tokens matching the Light Theme brief
- Explicit data states: `LIVE` · `STALE` · `OFFLINE` · `DEMO DATA`
- Unit tests for energy analytics and alarm filtering (`npm test`)

## Documentation

| Document | Path |
|----------|------|
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Requirements & assumptions | [docs/requirements-and-assumptions.md](docs/requirements-and-assumptions.md) |
| Development progress | [docs/development-progress.md](docs/development-progress.md) |
| Phase 1.5 architecture audit | [docs/phase-1.5-architecture-audit.md](docs/phase-1.5-architecture-audit.md) |
| Telemetry contract v1 | [docs/telemetry-contract-v1.md](docs/telemetry-contract-v1.md) |
| Database design v1 | [docs/database-design-v1.md](docs/database-design-v1.md) |
| Backend API design v1 | [docs/backend-api-design-v1.md](docs/backend-api-design-v1.md) |
| Open decisions | [docs/open-decisions.md](docs/open-decisions.md) |
| Phase 2a implementation report | [docs/phase-2a-implementation-report.md](docs/phase-2a-implementation-report.md) |
| Phase 2a API | [docs/api-v1-phase-2a.md](docs/api-v1-phase-2a.md) |
| Phase 2a schema | [docs/database-schema-phase-2a.md](docs/database-schema-phase-2a.md) |

Reference inputs (not in repo): `TEST_EMS_Requirement_Gap_Analysis.docx`, `TEST_EMS – Design Direction (Light Theme).docx`. PROJECT_EMS docs are supporting references only.

## Loads (confirmed)

| Load | Capacity |
|------|----------|
| AC-01 | 5 TR |
| AC-02 | 5 TR |
| AC-03 | 8 TR |
| Compressor-01 | Capacity / type **TBD** |

## Safety notice

TEST_EMS is a **monitoring** system only. It is not a protection device.
