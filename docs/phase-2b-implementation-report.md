# TEST_EMS Phase 2b — Final Implementation Report

**Completed Date:** 31 October 2026  
**Environment:** Windows (PowerShell) · Node.js v20+ · Fastify 5.6.1 · React 19 / Vite · MySQL 8.0.46 (`MySQL80_EMS`, port 3306)  
**Database:** `test_ems` (operational) / `test_ems_test` (automated test runner)  
**Final Test Status:** **169 / 169 Tests Passing** (96 Backend + 73 Frontend across 20 test files)  
**TypeScript Status:** 0 type errors backend, 0 type errors frontend, clean production build.

---

## 1. Executive Summary

Phase 2b transitions TEST_EMS from an isolated Phase 2a read-only skeleton into a fully integrated, production-grade telemetry ingestion pipeline and full-stack operational web application.

The system connects to local gateway servers via a resilient Bridge Service (WebSocket + catch-up HTTP polling), archives raw payloads with idempotent deduplication, decodes Modbus registers through a configurable multi-endian decoding engine, persists decoded samples to MySQL with strict `REAL` vs `DEMO` origin isolation, and exposes authenticated, rate-limited, and CSRF-protected operational read APIs to a modern, responsive React frontend.

---

## 2. Step-by-Step Implementation Summary (Steps 1–6)

### Step 1: Database Schema & Migrations
- Applied **Migration 004** (`004_phase2b_integration.sql`):
  - Added `source_type ENUM('REAL','DEMO')` across `gateways`, `meters`, and `telemetry_samples`.
  - Created composite foreign key `(meter_id, source_type)` enforcing strict origin isolation.
  - Created `raw_payloads` table with unique constraint `uq_raw_payload_dedup (gateway_mac, local_server_ts, payload_hash)`.
  - Created `metric_mappings` and append-only `metric_mapping_history`.
  - Created `users` and `user_sessions` tables.
- Applied **Migration 005** (`005_metric_mapping_verification_check.sql`):
  - Added database-level CHECK constraint `chk_mm_verified_fields` requiring `verified_by`, `verified_at`, and `evidence_note` whenever `verification_status = 'VERIFIED'`.
- Verified on clean and pre-seeded databases (H3/H5).

### Step 2: Bridge Service & Local Server Integration
- Built `LocalServerClient`:
  - Enforces strict path allowlist (`/login`, `/snapshot.json`, `/ws`), refusing 3xx redirects.
  - Rejects MAC mismatches and oversized payloads (>256 KB).
  - Sanitizes all secrets (cookies, passwords) from log streams.
- Built `BridgeService`:
  - Subscribes to live WebSocket stream with automatic reconnection and catch-up polling (`fetchLatest`) on reconnect (proven by test BR-11).
  - Implements timestamp monotonicity guard: detects and logs `tsReversals` without overwriting newer data.
  - Built in-process `FakeLocalServer` on dynamic ports for fully automated integration testing.

### Step 3: Authentication, Sessions & Security
- User authentication with Bcrypt (cost factor 10).
- Session security adhering strictly to Housekeeping H7:
  - Generates 32-byte cryptographically secure tokens.
  - Stores `SHA-256(token)` in `user_sessions.id` (raw token is never stored in DB).
  - Emits `HttpOnly; SameSite=Strict; Path=/` session cookie with 24h TTL.
- In-memory CSRF protection via `X-CSRF-Token` header on state-changing routes.
- IP-based rate limiting (5 failed login attempts per minute -> `429 RATE_LIMITED`).
- Forced password change flow: newly bootstrapped admin has `must_change_password = 1`, blocking state-changing operations until updated.
- Strict CORS validation against `env.CORS_ORIGIN`.

### Step 4: Metric Mapping Engine & Decoder
- Built `decodeMetric()` supporting:
  - **float32 IEEE 754**: All 4 combinations (`BE/BE` ABCD, `LE/BE` CDAB word swap, `BE/LE` BADC byte swap, `LE/LE` DCBA both swapped) verified against constructed test vectors for `230.5f`.
  - **Integer types**: `uint16`, `int16` (signed), `uint32`, `int32` (signed).
  - **Direct numbers**: `number` pass-through with `scale` and `offset` arithmetic.
- Honest null semantics: missing keys or `UNVERIFIED` mappings strictly produce `NULL` (never 0).
- Built Mapping Admin API:
  - `GET /api/system/mapping`: Returns meters and active mappings.
  - `PUT /api/system/mapping`: Authenticated, CSRF-protected mapping updates with version incrementing, history tracking, and evidence validation.
  - `POST /api/system/mapping/test`: Scoped test endpoint previewing decodes against the latest raw payload (`ignoreVerificationStatus: true` scope strictly isolated to this test tool; zero production write paths use it).

### Step 5: Telemetry Pipeline & Operational Read APIs
- Built production telemetry pipeline (`src/services/telemetryPipeline.ts`):
  - Invoked upon payload archival without verification bypass.
  - Writes to `telemetry_samples` with `source_type = 'REAL'`, sequence derived from payload `local_server_ts`, quality `'OK'`, and `NULL` for unverified metrics.
- Updated operational read endpoints:
  - `GET /api/overview`: Aggregated verified kW, loads reporting, aggregate PF (`total_kw / total_kva`), incomplete flag and `missing_loads` array if any load is unverified.
  - `GET /api/loads`: Catalogue list of loads.
  - `GET /api/loads/:id`: Operational load snapshot; returns `NO_DATA` when unverified.
  - `GET /api/loads/:id/history`: Chronological historical telemetry samples.
  - `GET /api/energy`: Cumulative and interval energy; rollover/reset detection (negative delta = `GAP`, never negative energy); flags partial days.
  - `GET /api/system/gateway`: Gateway status with meter states labeled `"gateway-level only"`.
  - `GET /api/bridge/status`: Live bridge connection mode and 10+ operational counters.

### Step 6: Full Frontend Implementation (6a–6d)
- **Step 6a (Adapter & Overview & Load Detail)**:
  - Typed `apiClient` with in-memory CSRF and credential management.
  - `DataSourceContext`: Explicit REAL vs DEMO toggle, localStorage persistence, immediate amber **DEMO ACTIVE** badge on load.
  - Dead demo-auth code fully purged.
- **Step 6b (Energy Page)**:
  - Wired to `GET /api/energy` and `GET /api/loads`.
  - GAP intervals rendered honestly with `connectNulls={false}`.
  - Dynamic CSV export: includes `# DATA_SOURCE: REAL` header, blank cells for GAP intervals (never 0).
  - Previous period bounds calculation using identical elapsed time-of-day windows.
  - Confirmed total active power / energy agreement between Overview and Energy page.
- **Step 6c (System Page)**:
  - Operational admin view: Bridge Status Card, Gateway Status Card ("gateway-level only" badges), Mapping Test UI, and expandable per-meter mapping editor.
  - Client-side evidence validation guard blocks Save button prior to API call when required evidence is missing.
- **Step 6d (Alarms Page)**:
  - REAL mode renders honest empty / `NO_DATA` state; never fabricates alarms, never falls back to demo data.
  - Gateway & Communication Health card wired to `GET /api/bridge/status` and `GET /api/system/gateway`.
  - Unified alarm count definition: "Open = still-raised (active + acknowledged, not cleared)" used consistently across Overview KPI (3), Header bell (3), and Alarms tab (3), eliminating the 2 vs 3 disagreement.
  - All dev-only simulation buttons (`Demo: loading state`, `Demo: error state`, `simulateLoad`) completely removed.

---

## 3. Explicit Boundaries & Out of Scope Items

The following features were intentionally excluded from Phase 2b and remain future work:

1. **Billing & Tariff Engine**: Tariffs and utility rate structures are unconfirmed; no billing columns or financial calculations exist in backend or frontend.
2. **Demand Calculation**: No sliding-window maximum demand computation. Only meter-reported maximum demand is displayed when verified.
3. **Alarm Evaluation Engine**: Threshold evaluation, trip limits (overcurrent, undervoltage), and automated notification routing are out of scope. Real alarms return an honest empty state (`NO_DATA`).
4. **Production Authentication Beyond Built Scope**: Enterprise SSO, LDAP/SAML, multi-tenant RBAC, and self-service email password resets are not built. The built auth covers single-site local users, bcrypt, session cookies, rate limiting, CSRF, and forced password change.
5. **Backfill on Mapping Promotion**: When an `UNVERIFIED` mapping is edited and promoted to `VERIFIED`, historical `raw_payloads` are NOT backfilled or reprocessed. Decoded metrics reflect verified status starting from the next live payload poll.

---

## 4. Hardware Verification Status: What is Still NOT Verified

Per the Phase 2b hardware audit ([docs/hardware/R1/](hardware/R1/)), the following physical and firmware aspects remain **UNVERIFIED against real hardware**:

| Item | Status | Risk / Required Action |
|---|---|---|
| **COM2 / J10 Trace Against Netlist** | **NOT VERIFIED** | Schematic naming conflict between brief (COM2 + UART2 + J8) vs controller firmware (COM2 = UART1/J10, COM3 = UART2/J8). Pin mux between GPIO16/17 and TX16/RX34 requires physical continuity test on assembled board. |
| **Two-Wire RS-485 Feasibility** | **NOT VERIFIED** | The board exposes separate `RS485_2_TX_*` and `RS485_2_RX_*` differential pairs. Whether half-duplex 2-wire Modbus multi-drop works via jumper/bridging without signal reflection is unproven on physical hardware. |
| **Secure Elite 103-2 Register Map** | **NOT VERIFIED** | Official Secure Meters / ConfigView register map documentation is absent. Register addresses, float vs integer formats, and word orders are proposed vectors only. |
| **Slave IDs & Serial Settings** | **NOT VERIFIED** | Site baud rates, parity, stop bits, slave IDs (1..4), and CT/PT primary/secondary ratios have not been inspected or confirmed on the installed meters. |
| **Real Captured Modbus Payloads** | **NOT VERIFIED** | No physical Modbus frame or HTTP payload has been captured from the real site installation. All testing used synthetic and simulated payloads conforming to contract specifications. |
| **Gateway Modbus Polling Firmware** | **NOT VERIFIED** | The gateway firmware running in production was identified in the R1 audit as a wifi-config build that lacks the Modbus RTU master polling task. Firmware with active polling must be compiled, flashed, and tested. |

---

## 5. Consolidated Housekeeping Record (H1–H7)

| ID | Title | Summary of Action Taken & Proof |
|---|---|---|
| **H1** | Demo Login Cleanup & Hardware Docs | Committed pre-existing demo-login work, imported R1 hardware audit documentation, and archived baseline verification screenshots (`bdbc3e5`). |
| **H2** | Test-Database Guard | Created `src/database/guard.ts` refusing to run tests on databases whose name does not contain `_test` or `test_`. Verified by unit tests H2-01 to H2-03 (`d8d4c4e`). |
| **H3** | Migration 004 Run Results | Executed Migration 004 on clean database and on database with Phase 2a seed data. Verified non-destructive column and constraint additions (`44416cc`). |
| **H4** | MySQL Version & CHECK Tests | Confirmed MySQL version **8.0.46**. Verified that CHECK constraints are strictly enforced by the engine via dedicated integration test `H4-check-constraint-violation` (`44416cc`). |
| **H5** | Migration 005 Evidence CHECK | Applied Migration 005 creating `chk_mm_verified_fields` on `metric_mappings`. Verified that `VERIFIED` status without evidence is rejected by MySQL (`3ca2693`). |
| **H6** | Gateway Disambiguation | Established strict isolation between placeholder gateway (`mac = NULL`) and live gateway (`mac = env.GATEWAY_MAC`). Seeded gateways can never ingest bridge telemetry (`44416cc`). |
| **H7** | Session Token Hashing | Replaced plain-text session tokens with cryptographically secure **SHA-256 token hashing** in `user_sessions.id`. Raw tokens are never persisted in the database (`01cd6d0`). |

---

## 6. Consolidated Automated Test Report (169 / 169 PASS)

### A. Backend Integration Tests (70 Tests)

| Suite | Test ID | Description | Result |
|---|---|---|:---:|
| **Bridge** | BR-01 | Login succeeds and session cookie is stored (never logged) | **PASS** |
| | BR-02 | Deny-by-default allowlist rejects unregistered paths | **PASS** |
| | BR-03 | MAC mismatch is rejected before HTTP call is made | **PASS** |
| | BR-04 | Redirects (3xx) are refused and treated as errors | **PASS** |
| | BR-05 | Oversize response (>256 KB) is rejected and counted | **PASS** |
| | BR-06 | fetchLatest returns snapshot with correct schema | **PASS** |
| | BR-07 | archiveSnapshot inserts row into raw_payloads | **PASS** |
| | BR-08 | Duplicate (gateway_mac, local_server_ts, payload_hash) dropped | **PASS** |
| | BR-09 | Timestamp reversal is counted and skipped (no overwrite) | **PASS** |
| | BR-10 | 401 mid-session triggers authErrors counter | **PASS** |
| | BR-11 | WS reconnect triggers catch-up poll and restores session | **PASS** |
| | BR-12 | Malformed JSON handled cleanly without process crash | **PASS** |
| | BR-13 | Bridge does NOT start when BRIDGE_ENABLED=false | **PASS** |
| | BR-14 | Secrets (cookies, passwords) never present in logs | **PASS** |
| **Auth** | AUTH-01 | Admin bootstrap creates user with must_change_password=1 | **PASS** |
| | AUTH-02 | Login succeeds, sets SameSite cookie, returns CSRF token | **PASS** |
| | AUTH-03 | Login fails with invalid credentials (401) | **PASS** |
| | AUTH-04 | Rate limiting triggers on 5 failed attempts (429) | **PASS** |
| | AUTH-05 | Session token in database is SHA-256 hash (H7) | **PASS** |
| | AUTH-06 | Session expiry is enforced (expired session -> 401) | **PASS** |
| | AUTH-07 | Forced password change blocks state-changing operations | **PASS** |
| | AUTH-08 | Password change rejects <8 chars or identical password | **PASS** |
| | AUTH-09 | CSRF protection rejects requests lacking X-CSRF-Token (403) | **PASS** |
| | AUTH-10 | CORS policy rejects requests from disallowed origins (403) | **PASS** |
| | AUTH-11 | PUT /api/system/mapping requires auth + CSRF | **PASS** |
| | AUTH-12 | Logout invalidates session in DB and clears cookie | **PASS** |
| **Mapping** | MAP-01 | GET /api/system/mapping returns meters with active mappings | **PASS** |
| | MAP-02 | PUT /api/system/mapping rejected (401) without auth | **PASS** |
| | MAP-03 | PUT /api/system/mapping rejected (403) without CSRF | **PASS** |
| | MAP-04 | PUT /api/system/mapping rejected when must_change_password=1 | **PASS** |
| | MAP-05 | PUT /api/system/mapping increments version & writes history | **PASS** |
| | MAP-06 | PUT /api/system/mapping rejects VERIFIED without evidence | **PASS** |
| | MAP-07 | POST /api/system/mapping/test returns raw keys next to decoded | **PASS** |
| | MAP-08 | POST /api/system/mapping/test decodes UNVERIFIED mapping | **PASS** |
| | MAP-09 | POST /api/system/mapping/test queries latest raw_payloads row | **PASS** |
| **Read APIs** | READ-01 | Incomplete aggregate: total kW null, missing_loads listed | **PASS** |
| | READ-02 | Complete aggregate: all verified -> sum active power kW | **PASS** |
| | READ-03 | Aggregate PF = total kW / total kVA only when verified | **PASS** |
| | READ-04 | Counter rollover detection in /api/energy (negative delta = GAP) | **PASS** |
| | READ-05 | UNVERIFIED metric returns null end-to-end | **PASS** |
| | READ-06 | VERIFIED metric returns decoded numeric value end-to-end | **PASS** |
| | READ-07 | REAL/DEMO isolation: DEMO records never appear, ?source=DEMO 400 | **PASS** |
| | READ-08 | Load with zero mappings returns NO_DATA cleanly | **PASS** |
| | READ-09 | GET /api/loads/:id/history returns historical samples | **PASS** |
| | READ-10 | GET /api/system/gateway returns "gateway-level only" state | **PASS** |
| | READ-11 | GET /api/bridge/status returns bridge metrics & mode | **PASS** |
| | READ-12 | No demand calculation — meter-reported demand only | **PASS** |
| **Schema** | P2B-01 | Migration 004 recorded in schema_migrations | **PASS** |
| | P2B-02 | Default seedCatalogue() seeds empty meters and mappings | **PASS** |
| | P2B-03 | Composite FK (meter_id, source_type) rejects origin mismatch | **PASS** |
| | P2B-04 | raw_payloads deduplication on unique constraint | **PASS** |
| | P2B-05 | metric_mappings supports decodes with append-only history | **PASS** |
| | P2B-06 | users and user_sessions enforce uniqueness & referential int | **PASS** |
| | P2B-07 | Migration 005 CHECK constraint rejects VERIFIED without evidence | **PASS** |
| **Database** | AT-01 | Migrations applied with valid SHA-256 checksums | **PASS** |
| | AT-02 | Catalogue seed creates exactly 4 loads (AC-01..03, Compressor) | **PASS** |
| | AT-05 | Composite FK prevents cross-origin sample insertion | **PASS** |
| | AT-07 | raw_payloads deduplication enforced by MySQL engine | **PASS** |
| | AT-08 | Checksum mismatch triggers migration abort | **PASS** |
| | AT-09 | Site gateway correctly seeded with unverified flag | **PASS** |
| | AT-10 | Metric mappings table created with expected columns | **PASS** |
| | AT-11 | Metric mapping history table created with expected columns | **PASS** |
| | AT-12 | H4 CHECK constraint violation test (MySQL 8.0.46) | **PASS** |
| **API Legacy**| AT-13 | GET /health/live returns process uptime | **PASS** |
| | AT-14 | GET /health/ready returns database connectivity | **PASS** |
| | AT-15 | GET /api/sites returns catalogue sites | **PASS** |
| | AT-16 | GET /api/sites/:id returns 404 for missing site | **PASS** |
| | AT-17 | GET /api/overview returns NO_DATA when no samples | **PASS** |
| | AT-18 | GET /api/loads returns loads list | **PASS** |
| | AT-19 | GET /api/loads/:id returns null measurements when unverified | **PASS** |
| | AT-20 | Analytical routes return UNAVAILABLE | **PASS** |
| | AT-21 | Ingest endpoint is NOT registered in router | **PASS** |

### B. Backend Unit Tests (26 Tests)

| Suite | Test ID | Description | Result |
|---|---|---|:---:|
| **Decoder** | DEC-01 | float32 BE/BE (ABCD) decodes 230.5 correctly | **PASS** |
| | DEC-02 | float32 LE/BE (CDAB word swap) decodes 230.5 correctly | **PASS** |
| | DEC-03 | float32 BE/LE (BADC byte swap) decodes 230.5 correctly | **PASS** |
| | DEC-04 | float32 LE/LE (DCBA both swapped) decodes 230.5 correctly | **PASS** |
| | DEC-05 | uint16 and int16 decodes with negative values | **PASS** |
| | DEC-06 | uint32 and int32 decodes with negative values | **PASS** |
| | DEC-07 | Direct number pass-through | **PASS** |
| | DEC-08 | Scale and offset arithmetic applied accurately | **PASS** |
| | DEC-09 | Missing source key produces NULL (never 0) | **PASS** |
| | DEC-10 | Null register value produces NULL (never 0) | **PASS** |
| | DEC-11 | UNVERIFIED mapping produces NULL without ignore flag | **PASS** |
| | DEC-12 | UNVERIFIED mapping decodes value when ignore flag true | **PASS** |
| **Contract** | TC-01..09 | Telemetry contract schema validation tests | **PASS** |
| **Guard** | H2-01 | Guard permits database names ending in `_test` | **PASS** |
| | H2-02 | Guard permits database names starting with `test_` | **PASS** |
| | H2-03 | Guard throws error on production database names | **PASS** |

### C. Frontend Unit & Integration Tests (73 Tests)

| Suite | Tests | Description | Result |
|---|:---:|---|:---:|
| `client.test.ts` | 5 | API adapter, CSRF storage, error handling, null preservation | **PASS** |
| `SystemPage.test.ts` | 13 | Mapping admin UI, VERIFIED evidence guard, bridge/gateway cards | **PASS** |
| `AlarmsPage.test.ts` | 7 | REAL NO_DATA state, 2 vs 3 alarm count agreement, dev buttons gone | **PASS** |
| `alarmFilters.test.ts`| 7 | Active vs cleared tabs, open count vs unacknowledged count | **PASS** |
| `powerChartModel.test.ts` | 5 | Multi-load stacked power chart model transformations | **PASS** |
| `DataSourceContext.test.ts` | 1 | REAL vs DEMO toggle, localStorage persistence | **PASS** |
| `chartFormat.test.ts` | 6 | Tabular number formatting, power factor, timestamps | **PASS** |
| `chartSeries.test.ts` | 7 | Timeseries bucketing, null sample gap preservation | **PASS** |
| `energyAnalytics.test.ts` | 11 | Period aggregation, rollover detection, REAL CSV export | **PASS** |
| `ui1-consistency.test.ts` | 11 | Overview vs Energy consistency, canonical demo series | **PASS** |

---

## 7. Verification Proof & Quality Sign-Off

1. **Clean Codebase Verification:**
   - Single regex grep across `frontend/src` for `(simulateLoad|loading state|error state|Demo:)`: **0 dev buttons found**.
   - Clean production build: `npm run build` in `frontend` completed in 1.09s with zero errors.
   - Clean TypeScript typecheck: `npm run typecheck` in `frontend` and `backend` completed with 0 errors.
2. **End-to-End Live Browser Evidence:**
   - Verified in headless browser session across 360px, 768px, 1024px, and 1440px viewports.
   - Real login via `POST /api/auth/login` receiving `ems_session` cookie cross-origin (`:3001` to `:5173`).
   - REAL mode displays honest `NO_DATA` badges and empty states across Overview, Energy, Loads, and Alarms.
   - DEMO mode displays prominent amber badges, consistent 3-alarm open counts, and disclaimers.

Phase 2b full-stack implementation is complete, verified, and ready for final review.
