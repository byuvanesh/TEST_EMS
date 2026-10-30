# TEST_EMS Architecture (Phase 0–1)

**Status:** Frontend Phase 0+1 complete. **Phase 2a backend foundation** exists under `backend/` (local MySQL, read APIs, no production ingest). Gateway/hardware verification is **not** completed.  
**Phase 1.5 audit pack:** [phase-1.5-architecture-audit.md](phase-1.5-architecture-audit.md) · [telemetry-contract-v1.md](telemetry-contract-v1.md) · [database-design-v1.md](database-design-v1.md) · [backend-api-design-v1.md](backend-api-design-v1.md) · [open-decisions.md](open-decisions.md)  
**Phase 2a:** [phase-2a-implementation-report.md](phase-2a-implementation-report.md) · [api-v1-phase-2a.md](api-v1-phase-2a.md) · [database-schema-phase-2a.md](database-schema-phase-2a.md)

## 1. Independence

TEST_EMS is a clean project under `B:\TEST_EMS`. It does not fork or copy PROJECT_EMS, Trikona OEM, or other codebases. Shared *ideas* from PROJECT_EMS documents are treated as **PROPOSED** until confirmed for TEST_EMS.

## 2. Proposed system context

```
[Secure Elite meters × 4] --RS-485 Modbus RTU--> [Gateway] --HTTPS/MQTT?--> [API]
                                                                              |
                                                                         [MySQL]
                                                                              |
                                                                    [React SPA]
```

**Confirmation required:** gateway product and RS-485 master capability; ingest contract (independent vs reuse); REST vs MQTT; hosting.

Phase 0 implements **only** the React SPA with isolated mock data.

## 3. Repository layout

```
B:\TEST_EMS\
  README.md
  docs\
    architecture.md
    requirements-and-assumptions.md
    development-progress.md
  frontend\                 # Vite + React + TypeScript
    src\
      app\                  # Router
      components\
        layout\             # Shell, sidebar, header, banners
        ui\                 # Design-system primitives
        charts\             # Recharts wrappers
      pages\                # Route-level screens
      mock\                 # DEMO DATA only (never mixed with API)
      types\                # Shared domain types
      lib\                  # format, cn
```

Phase 2a created: `backend/` (Fastify + MySQL migrations + read APIs). Production ingest and gateway firmware integration remain future work.

## 4. Frontend architecture

| Concern | Approach |
|---------|----------|
| Routing | `react-router-dom` — Overview, Energy, Alarms, System; Load Detail via `/loads/:loadId` |
| Styling | Tailwind CSS v4 + `@theme` design tokens |
| Icons | Lucide React |
| Charts | Recharts (no decorative gauges) |
| Data | `src/mock/demoData.ts` returns typed `OverviewDemoBundle`; swap to API client later |
| Data quality | Every reading / KPI / alarm carries `DataQualityState` |

### Design tokens

| Token | Value |
|-------|-------|
| Background | `#F7F9FC` |
| Card | `#FFFFFF` |
| Secondary surface | `#F1F4F9` |
| Primary text | `#172033` |
| Secondary text | `#64748B` |
| Border | `#E5EAF1` |
| Accent | `#2563EB` |
| Success / Warning / Critical | `#16A36A` / `#D99020` / `#DC4545` |

Typography: Inter. Readings use tabular numerals. Card radius 12 px; control radius 8 px.

### Load chart colours (categorical, stable per load)

| Load | Colour |
|------|--------|
| AC-01 | `#3B82F6` |
| AC-02 | `#0D9488` |
| AC-03 | `#7C3AED` |
| Compressor-01 | `#DB2777` |

## 5. Data integrity rules

1. States: `LIVE` | `STALE` | `OFFLINE` | `DEMO`.
2. All Phase 0 values are `DEMO`. Header badge + banner + per-card badges.
3. Mock module is physically separate from any future `services/api` layer.
4. Never invent Modbus addresses, scaling, CT ratios, or real gateway health.
5. Capability gating: advanced parameters show empty state until API reports availability.

## 6. Pages

| Page | Nav | Phase 0 |
|------|-----|---------|
| Overview | Yes | Full DEMO layout |
| Energy | Yes | Placeholder |
| Alarms | Yes | Demo table + placeholder notes |
| System | Yes | Load list + config placeholder |
| Load Detail | No (drill-down) | Electrical snapshot + breadcrumbs |

## 7. Decisions requiring confirmation

See [requirements-and-assumptions.md](requirements-and-assumptions.md). Highest impact for architecture:

- Stack confirmation (Fastify + MySQL + REST)
- Independent ingest contract vs reuse
- Gateway choice and Modbus master proof
- LIVE/STALE/OFFLINE time thresholds
- Auth / roles (Viewer, Operator, Admin proposed)
