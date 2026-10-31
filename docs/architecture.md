# TEST_EMS Architecture (Phase 2b)

**Status:** Full-Stack Phase 2b Complete.  
**Backend:** Node.js (v20+) + Fastify + MySQL 8.0.46 (`MySQL80_EMS`, port 3306) + WebSocket/HTTP Bridge to Trikona LocalServer.  
**Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4 + Recharts.  
**Implementation Reports:** [phase-2b-implementation-report.md](phase-2b-implementation-report.md) · [phase-2a-implementation-report.md](phase-2a-implementation-report.md)  
**API Specification:** [api-v1-phase-2b.md](api-v1-phase-2b.md)  
**Hardware Audit Pack:** [docs/hardware/R1/](hardware/R1/)

---

## 1. System Overview & Context

```
 +-----------------------------------------------------------------------+
 | Physical Hardware (Unverified / Pre-commissioning)                    |
 | [4x Secure Elite 103-2 Meters] --RS-485 Modbus RTU--> [Gateway COM2]  |
 +-----------------------------------------------------------------------+
                                    |
                                    v (LAN WebSocket + HTTP)
 +-----------------------------------------------------------------------+
 | Trikona LocalServer (or FakeLocalServer in integration tests)         |
 | - Polling loop publishes raw register maps over WS + /snapshot.json   |
 +-----------------------------------------------------------------------+
                                    |
                                    v (BridgeService)
 +-----------------------------------------------------------------------+
 | TEST_EMS Backend (Fastify :3001)                                      |
 |                                                                       |
 | 1. LocalServerClient: Strict allowlist, cookie auth, WS catch-up poll  |
 | 2. BridgeService: Archive raw payloads to MySQL `raw_payloads`        |
 | 3. Telemetry Pipeline: decodeMetric() -> writes `telemetry_samples`   |
 | 4. Metric Mapping Engine: DB CHECK-enforced VERIFIED evidence guard   |
 | 5. Auth & Session: Bcrypt, SHA-256 token hashing (H7), CSRF, Rate-lim |
 | 6. Operational Read APIs: Honest sums, null on UNVERIFIED, NO_DATA    |
 +-----------------------------------------------------------------------+
                                    |
                                    v (HTTP/REST + CSRF)
 +-----------------------------------------------------------------------+
 | TEST_EMS Frontend (React SPA :5173)                                   |
 |                                                                       |
 | 1. DataSourceContext: REAL vs DEMO toggle, immediate amber badge      |
 | 2. Typed apiClient: In-memory CSRF token, credentials include         |
 | 3. Overview Page: Aggregated verified kW, load drill-downs            |
 | 4. Energy Page: Real kWh intervals, rollover/GAP detection, CSV export|
 | 5. System Page: Live bridge counters, gateway state, mapping editor   |
 | 6. Alarms Page: Honest REAL NO_DATA state, single open-alarm count def|
 +-----------------------------------------------------------------------+
```

---

## 2. Ingestion & Bridge Architecture (Step 2)

### A. LocalServerClient
Connects to the local gateway server with strict security boundaries:
- **Strict Allowlist:** Rejects any path not explicitly registered (`/login`, `/snapshot.json`, `/ws`).
- **MAC Verification:** Gateway MAC from raw responses is validated against configured `GATEWAY_MAC`. Mismatches are rejected prior to ingestion.
- **Redirect Denial:** Redirects (3xx) are refused and treated as communication errors.
- **Payload Limits:** Oversized payloads (>256 KB) are rejected and counted.
- **Secret Sanitization:** Passwords and session cookies are filtered from all pino log streams.

### B. BridgeService Lifecycle & Resilience
- **Dual Transport:** Subscribes to the live WebSocket stream for immediate frame delivery, supplemented by periodic catch-up polling (`fetchLatest`) when WS is disconnected.
- **Deduplication:** Raw payloads are inserted into MySQL `raw_payloads` with a composite unique key:
  `UNIQUE KEY uq_raw_payload_dedup (gateway_mac, local_server_ts, payload_hash)`
  Duplicate frames are silently dropped.
- **Timestamp Monotonicity:** Reversals (`local_server_ts < last_archived_ts`) are tracked via `tsReversals` metric and rejected from overwriting newer telemetry.

---

## 3. Metric Mapping & Decoding Engine (Step 4)

### A. Decoder (`src/services/decoder.ts`)
Converts raw Modbus register holding values into domain engineering metrics:
- **float32 IEEE 754:** Supports all four byte/word order permutations:
  - Big-Endian / Big-Endian (`BE/BE` - ABCD)
  - Little-Endian / Big-Endian (`LE/BE` - CDAB, Word Swap)
  - Big-Endian / Little-Endian (`BE/LE` - BADC, Byte Swap)
  - Little-Endian / Little-Endian (`LE/LE` - DCBA, Both Swapped)
- **Integer Types:** `uint16`, `int16` (signed two's complement), `uint32`, `int32`.
- **Direct Numbers:** `number` pass-through with `scale` and `offset` arithmetic.
- **Honest Null Semantics:** Missing keys produce `null` (never `0`). Unverified mappings produce `null` during production pipeline execution.

### B. Database CHECK Constraint Guard (`chk_mm_verified_fields`)
Migration `005_metric_mapping_verification_check.sql` enforces that any mapping with `verification_status = 'VERIFIED'` MUST have non-empty audit evidence:
- `verified_by IS NOT NULL AND TRIM(verified_by) != ''`
- `verified_at IS NOT NULL`
- `evidence_note IS NOT NULL AND TRIM(evidence_note) != ''`
Violations are rejected at the MySQL engine level (confirmed on MySQL 8.0.46).

---

## 4. Production Telemetry Pipeline (Step 5)

When a raw payload is archived by `BridgeService`:
1. `processRawPayload()` is invoked with `ignoreVerificationStatus = false` (bypass strictly forbidden in production write path).
2. For each meter mapped to the gateway, active mappings from `metric_mappings` are evaluated against payload register keys.
3. Decoded values are written to `telemetry_samples`:
   - `source_type`: Hardcoded to `'REAL'`.
   - `sequence`: Derived from payload `local_server_ts` (milliseconds timestamp from gateway).
   - `quality`: Set to `'OK'`.
   - `mapping_version`: Current version of the applied mapping.
4. If a mapping is `UNVERIFIED`, its metric column is written as `NULL`. Missing rows are never skipped and never zero-filled.
5. Composite foreign keys `(meter_id, source_type)` strictly prohibit cross-contamination between `REAL` and `DEMO` data.

---

## 5. Security & Authentication Model (Step 3)

| Layer | Implementation |
|---|---|
| **Passwords** | Bcrypt (cost factor 10) |
| **Session Tokens** | Cryptographically random 32-byte hex token. Stored in DB as **`SHA-256(token)`** per Housekeeping H7 (raw token never stored). |
| **Cookies** | `ems_session`, `HttpOnly`, `SameSite=Strict`, `Path=/`, 24h TTL. |
| **CSRF** | In-memory `X-CSRF-Token` header returned on login. Required for state-changing endpoints (`POST`, `PUT`, `DELETE`). |
| **Rate Limiting** | Max 5 failed logins per minute per IP (`429 RATE_LIMITED`). |
| **Forced Password Change** | Admin bootstrapped with `must_change_password = 1`. State-changing operations blocked until password changed via `POST /api/auth/change-password`. |
| **CORS** | Strict origin check against `env.CORS_ORIGIN` (`403 CORS_DISALLOWED`). |

---

## 6. Frontend Architecture (Step 6)

### A. Data Source Separation
`DataSourceContext` provides a global toggle between `REAL` and `DEMO` modes:
- Persists user selection in `localStorage`.
- Immediate amber **DEMO ACTIVE** banner and header badge rendered on load when `DEMO` is active, preventing any confusion with real telemetry.
- All mock demo data is isolated under `frontend/src/mock/` and completely excluded from operational API paths.

### B. Typed API Adapter (`frontend/src/api/client.ts`)
- Holds CSRF token strictly in JavaScript heap memory (never written to `localStorage` or `sessionStorage`).
- Disallows silent null coercion: `null` from backend APIs remains `null` in the UI to prevent false "zero load" reporting.

### C. Consistent Alarm Definition
- Canonical definition: **"Open = still-raised (active + acknowledged, not cleared)"**.
- Overview KPI, Header bell badge, and Alarms page tab count all consume `openCount` (= 3 in DEMO, = 0 in REAL). Disagreements (2 vs 3) are eliminated.

### D. Production Cleanliness
- Dev-only simulated loading/error state buttons removed entirely.
- Zero simulated dev triggers in production builds.
