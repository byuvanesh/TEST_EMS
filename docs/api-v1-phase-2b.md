# TEST_EMS API v1 — Phase 2b Specification

**Base URL (local):** `http://127.0.0.1:3001`  
**Protocol:** HTTP/1.1 REST + JSON (UTF-8)  
**Authentication:** Cookie-based session (`ems_session`, `HttpOnly; SameSite=Strict; Path=/`)  
**CSRF Protection:** Double-submit / in-memory header (`X-CSRF-Token`) required on state-changing methods (`POST`, `PUT`, `DELETE`, `PATCH`).  
**CORS:** Configured for `CORS_ORIGIN` (`http://localhost:5173` in local dev). Disallowed origins receive `403 CORS_DISALLOWED`.  
**Data Isolation:** All operational read APIs enforce `source_type = 'REAL'`. Requests passing `?source_type=DEMO` are rejected with `400 DEMO_NOT_ALLOWED`.

---

## 1. Authentication & Session Endpoints

### `POST /api/auth/login`
Authenticates a user, establishes an HTTP-only session cookie, and returns user info + CSRF token.

- **Rate Limit:** 5 failed attempts per minute per IP. Excess attempts receive `429 RATE_LIMITED`.
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "AdminPass123!"
  }
  ```
- **Response Headers:**
  `Set-Cookie: ems_session=<token>; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
- **Response Body (200 OK):**
  ```json
  {
    "user": {
      "id": "usr_01J...",
      "username": "admin",
      "role": "admin",
      "must_change_password": false
    },
    "csrf_token": "a1b2c3d4..."
  }
  ```
- **Errors:**
  - `401 INVALID_CREDENTIALS`: Username or password incorrect.
  - `429 RATE_LIMITED`: Too many failed attempts.

---

### `POST /api/auth/logout`
Terminates the current session, deletes the session row from `user_sessions`, and clears the cookie.

- **Headers:** `X-CSRF-Token: <token>`
- **Response (200 OK):**
  ```json
  { "success": true }
  ```

---

### `GET /api/auth/me`
Returns current session user info and password-change requirement.

- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "usr_01J...",
      "username": "admin",
      "role": "admin",
      "must_change_password": false
    }
  }
  ```
- **Errors:** `401 UNAUTHENTICATED` if session missing or expired.

---

### `POST /api/auth/change-password`
Changes user password. Mandatory when `must_change_password = 1` before performing any state-changing operations.

- **Headers:** `X-CSRF-Token: <token>`
- **Request Body:**
  ```json
  {
    "current_password": "CurrentPassword123!",
    "new_password": "NewStrongPassword456!"
  }
  ```
- **Validation:** Minimum 8 characters; new password must not equal current password.
- **Response (200 OK):**
  ```json
  { "success": true }
  ```
- **Errors:**
  - `400 INVALID_PASSWORD`: New password too short or identical to current.
  - `401 INVALID_CREDENTIALS`: Current password incorrect.

---

## 2. Operational Read Endpoints

### `GET /api/overview` (also `/api/v1/overview`)
Returns site electrical summary aggregated from verified meter mappings.

- **Query Parameters:** None (convenience endpoint for default site).
- **Behavior:**
  - `total_active_power_kw`: Real sum across all verified loads. If any load has an `UNVERIFIED` mapping or missing metric, `total_active_power_kw` is `null`, `incomplete` is `true`, and `missing_loads` lists the incomplete load codes.
  - `aggregate_pf`: Verified ratio (`total_kw / total_kva`) only when active power and apparent power are both verified for all reporting loads; otherwise `null`.
  - Never coerces `null` to `0`.
- **Response (200 OK):**
  ```json
  {
    "site_id": "site_01J...",
    "as_of": "2026-10-31T10:00:00.000Z",
    "data_state": "LIVE",
    "total_active_power_kw": 84.5,
    "incomplete": false,
    "missing_loads": [],
    "loads_reporting": 4,
    "loads_expected": 4,
    "aggregate_pf": 0.92,
    "gateway": {
      "id": "gw_01J...",
      "name": "Site Gateway",
      "link_state": "online"
    },
    "origin_assurance": "LABEL_ONLY"
  }
  ```

---

### `GET /api/loads` (also `/api/v1/loads`)
Returns catalogue list of electrical loads.

- **Query Parameters:** `?siteId=` (optional).
- **Response (200 OK):**
  ```json
  {
    "loads": [
      {
        "id": "load_01J...",
        "code": "AC-01",
        "name": "Air Conditioning 01",
        "sort_order": 10
      },
      {
        "id": "load_02J...",
        "code": "AC-02",
        "name": "Air Conditioning 02",
        "sort_order": 20
      },
      {
        "id": "load_03J...",
        "code": "AC-03",
        "name": "Air Conditioning 03",
        "sort_order": 30
      },
      {
        "id": "load_04J...",
        "code": "Compressor-01",
        "name": "Main Compressor",
        "sort_order": 40
      }
    ]
  }
  ```

---

### `GET /api/loads/:id` (also `/api/v1/loads/:id`)
Returns current electrical telemetry snapshot for a single load.

- **Path Parameters:** `:id` (load UUID or load code like `AC-01`).
- **Behavior:**
  - Reads latest `telemetry_samples` row for assigned meter where `source_type = 'REAL'`.
  - Metrics with `UNVERIFIED` mappings return `null` (never `0`).
- **Response (200 OK):**
  ```json
  {
    "load_id": "load_01J...",
    "code": "AC-01",
    "name": "Air Conditioning 01",
    "data_state": "LIVE",
    "as_of": "2026-10-31T10:00:00.000Z",
    "measurements": {
      "active_power_kw": 22.4,
      "current_a": 34.2,
      "voltage_v": 415.1,
      "power_factor": 0.91,
      "frequency_hz": 50.0,
      "energy_today_kwh": null
    },
    "origin_assurance": "LABEL_ONLY"
  }
  ```

---

### `GET /api/loads/:id/history`
Returns chronological telemetry samples for a load.

- **Path Parameters:** `:id` (load UUID or load code).
- **Query Parameters:** `?limit=25` (max 100).
- **Response (200 OK):**
  ```json
  {
    "load_id": "load_01J...",
    "code": "AC-01",
    "samples": [
      {
        "sample_time": "2026-10-31T10:00:00.000Z",
        "active_power_kw": 22.4,
        "current_a": 34.2,
        "voltage_v": 415.1,
        "power_factor": 0.91,
        "frequency_hz": 50.0,
        "active_import_kwh": null,
        "quality": "OK"
      }
    ]
  }
  ```

---

### `GET /api/energy` (also `/api/v1/analytics/energy`)
Returns energy consumption intervals and cumulative totals.

- **Query Parameters:**
  - `preset`: `today` | `yesterday` | `7d` | `month` | `custom`
  - `start`: ISO timestamp (required for custom)
  - `end`: ISO timestamp (required for custom)
  - `loadId`: Filter by specific load code or `all`
- **Behavior:**
  - Detects counter resets and rollovers (negative delta = `GAP`, never negative kWh).
  - Flags partial periods (e.g. today through snapshot) with `partial_period: true`.
- **Response (200 OK):**
  ```json
  {
    "period": { "preset": "today", "start": "2026-10-31T00:00:00+05:30", "end": "2026-10-31T11:45:00+05:30" },
    "load_filter": "all",
    "energy_kwh": null,
    "data_state": "NO_DATA",
    "intervals": [],
    "partial_period": true,
    "partial_period_message": "Incomplete day through current sample time.",
    "gap_count": 0,
    "origin_assurance": "LABEL_ONLY"
  }
  ```

---

## 3. System & Hardware Management Endpoints

### `GET /api/system/gateway`
Returns gateway hardware status and meter connection states.

- **Behavior:** Meter communication state is explicitly labeled `"gateway-level only"`. Individual meter communication failure is not distinguishable without slave-level poll logging.
- **Response (200 OK):**
  ```json
  {
    "gateway": {
      "id": "gw_01J...",
      "code": "gw_site_01",
      "name": "Site Gateway",
      "mac": "AA:BB:CC:DD:EE:01",
      "firmware_version": "1.0.4-rtu",
      "rs485_master_verified": true,
      "status": "connected",
      "mode": "websocket",
      "last_receive_time": "2026-10-31T10:00:00.000Z"
    },
    "meters": [
      {
        "meter_id": "mtr_01J...",
        "label": "AC-01 Meter",
        "slave_id": 1,
        "state_assurance": "gateway-level only",
        "status": "online",
        "note": "Gateway link state only; individual meter communication is not verified"
      }
    ]
  }
  ```

---

### `GET /api/bridge/status`
Returns live BridgeService telemetry ingestion counters and connection health.

- **Response (200 OK):**
  ```json
  {
    "status": "connected",
    "mode": "websocket",
    "last_receive_time": "2026-10-31T10:00:00.000Z",
    "metrics": {
      "pollsTotal": 1420,
      "pollsOk": 1418,
      "pollsError": 2,
      "wsFramesTotal": 8500,
      "archiveInserts": 1418,
      "archiveDuplicates": 0,
      "archiveOversized": 0,
      "tsReversals": 0,
      "decodeErrors": 0,
      "authErrors": 0
    }
  }
  ```

---

### `GET /api/system/mapping`
Returns all meters with their active metric mappings.

- **Response (200 OK):**
  ```json
  {
    "meters": [
      {
        "id": "mtr_01J...",
        "label": "AC-01 Meter",
        "source_type": "REAL",
        "slave_id": 1,
        "model": "Secure Elite 103-2",
        "model_code": "SE-103-2",
        "modbus_variant_verified": false,
        "gateway": { "id": "gw_01J...", "code": "gw_site_01", "mac": "AA:BB:CC:DD:EE:01" },
        "mappings": [
          {
            "id": "map_01J...",
            "metric": "active_power_kw",
            "source_keys": ["s1_hold1", "s1_hold2"],
            "decode": "float32",
            "word_order": "BE",
            "byte_order": "BE",
            "scale": 1.0,
            "offset": 0.0,
            "unit": "kW",
            "verification_status": "UNVERIFIED",
            "verified_by": null,
            "verified_at": null,
            "evidence_note": null,
            "version": 1
          }
        ]
      }
    ]
  }
  ```

---

### `PUT /api/system/mapping`
Updates or creates metric mappings for a meter. Increments mapping version and appends an audit record to `metric_mapping_history`.

- **Security:** Requires valid session cookie (`ems_session`) AND `X-CSRF-Token` header. Blocked if `must_change_password = 1`.
- **Database CHECK Constraint Guard:** If `verification_status = 'VERIFIED'`, then `verified_by`, `verified_at` (ISO date), and `evidence_note` MUST NOT be null or whitespace. Enforced by database constraint `chk_mm_verified_fields`.
- **Request Body:**
  ```json
  {
    "meter_id": "mtr_01J...",
    "mappings": [
      {
        "metric": "active_power_kw",
        "source_keys": ["s1_hold1", "s1_hold2"],
        "decode": "float32",
        "word_order": "BE",
        "byte_order": "BE",
        "scale": 1.0,
        "offset": 0.0,
        "unit": "kW",
        "verification_status": "VERIFIED",
        "verified_by": "engineer.lead",
        "verified_at": "2026-10-31T10:00:00.000Z",
        "evidence_note": "Verified with Fluke 435-II bench comparison"
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "meter_id": "mtr_01J...",
    "updated_count": 1
  }
  ```
- **Errors:**
  - `400 INVALID_MAPPING`: Missing verification evidence fields for `VERIFIED` status, or invalid decode/order.
  - `401 UNAUTHENTICATED`: Session cookie missing or invalid.
  - `403 FORBIDDEN`: Missing CSRF header or user must change password.

---

### `POST /api/system/mapping/test`
Decodes an experimental or unverified mapping against the latest archived raw payload for a meter.

- **Scope:** Testing and verification UI only. Uses `ignoreVerificationStatus: true` internally to preview what the decoded value would be. **Never writes to `telemetry_samples`.**
- **Request Body:**
  ```json
  {
    "meter_id": "mtr_01J...",
    "mapping": {
      "metric": "active_power_kw",
      "source_keys": ["s1_hold1", "s1_hold2"],
      "decode": "float32",
      "word_order": "BE",
      "byte_order": "BE",
      "scale": 1.0,
      "offset": 0.0,
      "unit": "kW",
      "verification_status": "UNVERIFIED"
    }
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "metric": "active_power_kw",
    "raw_keys": { "s1_hold1": 17254, "s1_hold2": 32768 },
    "decoded_value": 230.5,
    "unit": "kW",
    "decode": "float32",
    "word_order": "BE",
    "byte_order": "BE",
    "scale": 1.0,
    "offset": 0.0,
    "verification_status": "UNVERIFIED",
    "local_server_ts": 1730372400000
  }
  ```

---

## 4. Health Endpoints

### `GET /health/live`
Process liveness check.
- **Response (200 OK):** `{ "status": "ok", "uptime": 124.5 }`

### `GET /health/ready`
Database readiness check. Pings MySQL connection pool.
- **Response (200 OK):** `{ "status": "ready", "database": "connected" }`
