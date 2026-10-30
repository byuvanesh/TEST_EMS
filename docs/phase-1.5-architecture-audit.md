# TEST_EMS — Phase 1.5 Architecture and Data Contract Audit

**Date:** 30 Oct 2026  
**Scope:** Read-only inspection of `B:\TEST_EMS` after Phase 0 + Phase 1  
**Application code modified:** No  
**Hardware / gateway verification claimed:** No

Companion documents:

| Document | Purpose |
|----------|---------|
| [telemetry-contract-v1.md](telemetry-contract-v1.md) | Versioned ingest JSON contract |
| [database-design-v1.md](database-design-v1.md) | MySQL entity / table proposal |
| [backend-api-design-v1.md](backend-api-design-v1.md) | Fastify REST routes and services |
| [open-decisions.md](open-decisions.md) | Decision register by certainty class |

---

## 1. Inventory of what exists

### 1.1 Layout

```
B:\TEST_EMS\
  docs\                          # architecture + this audit pack
  frontend\                      # Vite + React 19 + TypeScript + Tailwind v4
    src\
      app\router.tsx
      components\layout|ui|charts
      lib\                       # period, energyAnalytics, alarmFilters, format, seed
      mock\                      # DEMO DATA only
      pages\                     # Overview, Energy, Alarms, System, LoadDetail
      types\index.ts
  backend\                       # DOES NOT EXIST
```

### 1.2 Pages and data sources

| Page | Data source today | DEMO labelling |
|------|-------------------|----------------|
| Overview | `getOverviewData()` static bundle | Banner + header badge + per-card badges |
| Energy | `buildEnergyAnalytics()` seeded generator | Banner + badges + chart tooltips + CSV header |
| Alarms | `createDemoAlarms()` + local React state | Banner + per-row badges + drawer disclaimer |
| System | `systemDemoConfig` labelled fields | Banner + ConfigLabel certainty chips |
| Load Detail | Overview load snapshot | Banner + badges |

### 1.3 Hooks / services

- **No** `src/hooks/` directory.
- **No** `src/services/` or API client.
- Only React hooks in use: `useState`, `useMemo`, `useParams`.
- **No** `fetch` / axios / WebSocket usage.

### 1.4 Shared configuration

| Asset | Location | Notes |
|-------|----------|-------|
| Load catalogue | `mock/loads.ts` | CONFIRMED names/capacities; chart colours |
| Domain types | `types/index.ts` | Shared UI shapes; suitable as starting DTOs |
| Period helpers | `lib/period.ts` | Reusable period math; demo anchor hardcoded |
| Alarm filter/ack | `lib/alarmFilters.ts` | Pure functions — reusable with API data |
| Energy analytics | `lib/energyAnalytics.ts` | **Demo-only physical model** — see §4 |

---

## 2. Frontend audit findings

### 2.1 Demo isolation — **PASS with caveats**

**Pass**

- All fabricated telemetry lives under `src/mock/`.
- Every reading / KPI / alarm / gateway object carries `dataState: 'DEMO'`.
- UI surfaces DEMO via `StatusBadge`, `DataStateBanner`, chart tooltip suffixes, CSV comments.
- System page uses PROPOSED / TBD / NOT CONFIGURED / VERIFY — does not invent registers, CT ratios, or slave IDs as confirmed.
- Alarm acknowledgement mutates **local** state only; disclaimer is explicit.

**Caveats (not blockers for Phase 2 design)**

| ID | Finding | Risk |
|----|---------|------|
| F-01 | `LOAD_DEFINITIONS` lives in `mock/` but is treated as real site config | Confuses config vs demo; move to `config/` or API-backed catalogue before live mode |
| F-02 | `energyAnalytics.ts` imports `LOAD_DEFINITIONS` from `mock/loads` | Couples calculation module to mock package path |
| F-03 | `AppShell` / Overview / Load Detail call `getOverviewData()` directly | No seam for API swap; needs a data-access layer |
| F-04 | Overview KPIs are **static** numbers; Energy KPIs are **computed** from a different generator | “Energy today” on Overview (128.6 kWh) ≠ Energy page “Today” total — both DEMO, but inconsistent |

### 2.2 DEMO DATA indicator coverage — **PASS**

Verified present on:

- Global header (`Header` ← `AppShell.globalDataState`)
- Page banners (Overview, Energy, Alarms, System, Load Detail)
- KPI / load / alarm cards and table rows
- Chart tooltips (`· DEMO DATA`)
- Energy CSV preamble
- Sidebar safety line

LIVE / STALE / OFFLINE badge styles exist but are **unused** with real thresholds — PROPOSED UI only until limits confirmed.

### 2.3 Duplicated or parallel calculations

| Topic | Where | Issue |
|-------|-------|-------|
| Hourly power synthesis | `demoData.buildPowerSeries` vs `energyAnalytics.demoPowerKw` | Two independent demo models |
| Coverage gap (~4%) | `buildHourlySeries`, `buildRawHourlyEnergy`, `perLoadPowerStats` | Triplicated seeded gap logic |
| Period previous window | `previousPeriodBounds` (good) vs EnergyPage inline Δ for peak/avg | Peak/avg Δ re-implemented in JSX instead of shared helper |
| Contribution % | Energy table only | Overview has no contribution ranking |
| Aggregate PF | Overview KPI hardcoded `0.91` | Not derived from ΣkW / ΣkVAr anywhere |

### 2.4 Calculations that incorrectly imply confirmed meter physics

These are **acceptable for DEMO UI** but **must not** be reused as production energy math:

| Calculation | Current demo behaviour | Why unsafe for REAL |
|-------------|------------------------|---------------------|
| Period energy | Sum of hourly kW ≈ kWh | Real energy must come from **import energy counter deltas** (VERIFY register/scaling) |
| Missing sample | Written as `0` | Conflates missing with zero load — understates coverage impact, corrupts averages |
| Peak power | Max of hourly (or daily avg for multi-day demand chart) | Billing demand interval **TBD**; not meter MD register |
| Multi-day demand chart | Daily **average** power | Misleading if labelled “demand” without caveat (UI note exists) |
| Coverage | Valid hours / expected hours with synthetic gaps | Expected interval depends on poll/storage policy (**TBD**) |
| Stale exclusion | None | Partial-site totals rules (**TBD**, X-05) |
| Counter rollover | Not modelled | Required for REAL (**TBD** width/threshold) |
| ON/OFF runtime | Not modelled | Thresholds TBD |

### 2.5 UI components that will need API integration

| Component / page | Future API dependency |
|------------------|----------------------|
| `AppShell` / `Header` | Site metadata, global data-quality, active alarm count |
| `OverviewPage` | Live KPIs, load snapshots, 24 h series, top alarms, gateway health |
| `EnergyPage` | Server-side (or service) analytics for period + filter; CSV from API or client of API series |
| `AlarmsPage` | List/filter; acknowledge POST; historical query |
| `SystemPage` | Config read (and later write for Admin); device status |
| `LoadDetailPage` | Per-load latest + capability flags for advanced params |
| `KpiCard` / `LoadCard` / charts | Remain presentational if fed typed DTOs |
| Search / notifications | Currently disabled placeholders |

**Recommended seam (PROPOSED):** introduce `src/services/` with interfaces (`OverviewService`, `EnergyService`, …) and a `Demo*` implementation wrapping current mock modules — no UI rewrite required for Phase 2 scaffolding.

### 2.6 TypeScript model fitness

**Reusable as presentation DTOs:** `LoadElectricalReading`, `AlarmItem`, `KpiSnapshot`, `EnergyAnalyticsResult`, `DataQualityState`.

**Needs evolution for backend:**

- `LoadId` as string union of four names → opaque IDs + display codes (multi-site future).
- `EnergyBucket` hard-codes four load keys → map / array of series keyed by load id.
- Missing `sourceType: 'DEMO' | 'REAL'` separate from freshness `LIVE|STALE|OFFLINE`.
- No telemetry sample / energy counter types yet (see telemetry contract).

---

## 3. Data model proposal (summary)

Full DDL thinking: [database-design-v1.md](database-design-v1.md).

**Principle:** store **raw meter observations** separately from **derived** quantities (period energy, peak demand, aggregate PF, coverage, ON/OFF).

```
sites 1──* loads 1──0..1 meters
sites 1──* gateways 1──* meters (assignment)
users / roles / sessions
telemetry_samples (raw electrical + optional energy_counter)
energy_counter_events (optional explicit counter snapshots)
derived_energy_intervals (materialized period rollups — DERIVED)
alarms / alarm_events
device_comm_status
config_settings / config_revisions
audit_logs
```

Certainty:

| Entity concept | Class |
|----------------|-------|
| Four loads AC-01…Compressor-01 | CONFIRMED (R001) |
| One meter per load | PROPOSED (R003) |
| Gateway entity | PROPOSED / VERIFY capability |
| Users & three roles | PROPOSED |
| UTC storage, IST display | PROPOSED |
| Retention periods | TBD |

---

## 4. Energy calculation audit (detail)

File: `frontend/src/lib/energyAnalytics.ts`.

### 4.1 Safe to reuse (presentation / orchestration)

| Piece | Verdict |
|-------|---------|
| `resolveIncludedLoads` | Reuse |
| `resolvePeriodBounds` / `previousPeriodBounds` | Reuse with real “now” and confirmed TZ policy |
| `percentDelta` / contribution % arithmetic | Reuse on **derived** inputs |
| `buildEnergyCsv` structure | Reuse shape; mark `sourceType` |
| `EnergyAnalyticsResult` DTO | Reuse as API response shape |
| Filter → chart/table binding in `EnergyPage` | Reuse |

### 4.2 Must redesign for REAL meter data

| Piece | Demo today | Real requirement |
|-------|------------|------------------|
| Energy kWh | Σ hourly kW | Δ of cumulative **active energy import** between period bounds; IST day boundaries **PROPOSED** |
| Gaps | Zero-fill | No power interpolation; energy via counter; chart gaps as null |
| Peak demand | Max hourly sample | Demand interval / sliding vs fixed / reset — **TBD**; may use meter MD if VERIFY |
| Aggregate PF | Not in energy module; Overview fake | ΣkW ÷ √((ΣkW)²+(ΣkVAr)²) when kvar available; “—” if ΣkW=0 — **DERIVED**, kvar sign **VERIFY** |
| Coverage | Synthetic 4% dropouts | valid_samples ÷ expected_samples from configured interval |
| Stale exclusion | N/A | Per-load freshness; totals show “n of 4 reporting” — rule **TBD** (X-05) |
| Partial loads | Filter only | Same + quality flags on aggregates |
| Rollover / reset | N/A | Detect negative/large drop; new baseline + audit — **TBD** |
| `demoPowerKw` / seed PRNG | Demo only | Delete from production path |

**Do not treat mock calculations as validated physical energy calculations.**

---

## 5. Backend readiness (evaluation)

| Stack item | Class | Readiness |
|------------|-------|-----------|
| Fastify + TypeScript | PROPOSED | Suitable; not confirmed |
| MySQL | PROPOSED | Suitable for relational config + rollups; time-series volume needs rollup strategy (P-01) |
| REST API | PROPOSED | Fine for SPA; ingest may still be REST POST from gateway (**TBD** vs MQTT) |

**Not ready to implement** until open decisions in [open-decisions.md](open-decisions.md) unblock ingest identity, auth, and energy semantics. Designing contracts/DDL **now** is appropriate; coding backend **after** minimum decision set is recommended.

See [backend-api-design-v1.md](backend-api-design-v1.md).

---

## 6. Architecture risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R-A | Ingest contract independence unclear (X-01) | High | Decide TEST_EMS-owned v1 contract (this pack proposes one) |
| R-B | No official register map / scaling | High | Keep measurements optional; capability flags; bench VERIFY |
| R-C | Gateway Modbus master unproven | High | Treat gateway as VERIFY; UI already unknown |
| R-D | Demo energy math mistaken for production | High | Separate `demo` vs `derived` services; code review gate |
| R-E | Zero-fill missing samples | Medium | Contract + DB use NULL; charts gap |
| R-F | Hard-coded four load keys in series types | Medium | Normalize to load_id columns / JSON maps |
| R-G | No auth / audit for alarm ack or config | Medium | Design tables now; implement with roles |
| R-H | 10 s raw × 30 d volume (P-01) | Medium | Rollup tables + retention TBD |
| R-I | Overview vs Energy demo inconsistency | Low | Accept for demo or unify generators pre-Phase 2 UI polish |

---

## 7. Phase 2 readiness verdict

### Ready for Phase 2 **design and scaffolding**

- Frontend structure is clean and DEMO-labelled.
- Domain types and alarm filter helpers are a good starting point.
- Telemetry / DB / API proposals in this pack are sufficient to start a `backend/` skeleton **behind feature flags**.

### **Not** ready to claim Phase 2 “live telemetry complete”

Blockers before trusting REAL numbers:

1. Confirm or adopt telemetry contract ownership (X-01).
2. Official or bench-verified register map + scaling (R017/R018) — **without inventing addresses in docs/code**.
3. Gateway RS-485 master evidence (R019 VERIFY).
4. CT ratios / wiring (M-02) for any accuracy claim.
5. Energy counter behaviour (width, unit, rollover) VERIFY.
6. Demand interval + stale thresholds + partial-total rules TBD.
7. Auth model if System / acknowledge leave the demo sandbox.

### Recommendation

Proceed to **Phase 2a — Backend skeleton + contract validation harness** (ingest endpoint accepting REAL and DEMO sources separately, persistence, read APIs returning `sourceType` + quality).  
Defer **Phase 2b — Live meter integration** until VERIFY items above have evidence.

**Hardware and gateway functionality have not been verified by this audit.**
