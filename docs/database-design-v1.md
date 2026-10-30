# TEST_EMS Database Design v1

**Status:** PROPOSED  
**Engine:** MySQL 8.x (**PROPOSED** stack — not confirmed)  
**Principles:** UTC timestamps; raw vs derived separation; DEMO/REAL segregation; no invented Modbus maps or CT values stored as “confirmed”.

Related: [telemetry-contract-v1.md](telemetry-contract-v1.md), [backend-api-design-v1.md](backend-api-design-v1.md)

---

## 1. Entity overview

```
sites
  ├── loads
  │     └── meters (0..1 current assignment)
  ├── gateways
  │     └── gateway_meter_links
  ├── users / role_bindings
  ├── telemetry_samples          ← RAW
  ├── energy_counter_snapshots   ← RAW (optional densification)
  ├── derived_load_intervals     ← DERIVED rollups
  ├── derived_site_intervals     ← DERIVED
  ├── alarms / alarm_transitions
  ├── device_comm_status
  ├── config_settings / config_revisions
  └── audit_logs
```

---

## 2. Tables (logical DDL)

Types are illustrative. Exact lengths/enums TBD during implementation.

### 2.1 `sites`

| Column | Type | Notes | Class |
|--------|------|-------|-------|
| `id` | CHAR(26)/UUID | PK | PROPOSED |
| `code` | VARCHAR(64) | Stable site code | TBD (M-06) |
| `name` | VARCHAR(255) | | TBD |
| `timezone` | VARCHAR(64) | e.g. `Asia/Kolkata` | PROPOSED |
| `created_at` | DATETIME(3) | UTC | PROPOSED |

### 2.2 `loads`

| Column | Type | Notes | Class |
|--------|------|-------|-------|
| `id` | UUID | PK | PROPOSED |
| `site_id` | UUID | FK | PROPOSED |
| `code` | VARCHAR(32) | `AC-01`… | CONFIRMED set today |
| `name` | VARCHAR(128) | | CONFIRMED |
| `capacity_label` | VARCHAR(64) | `5 TR` / `Capacity TBD` | CONFIRMED / TBD compressor |
| `chart_color` | CHAR(7) | UI | PROPOSED |
| `sort_order` | INT | | PROPOSED |
| `is_active` | BOOL | | PROPOSED |

**Unique:** `(site_id, code)`.

### 2.3 `meters`

| Column | Type | Notes | Class |
|--------|------|-------|-------|
| `id` | UUID | PK | PROPOSED |
| `site_id` | UUID | FK | PROPOSED |
| `label` | VARCHAR(128) | Human label | TBD |
| `manufacturer` | VARCHAR(64) | nullable | TBD |
| `model` | VARCHAR(64) | nullable — Elite variant VERIFY | VERIFY |
| `serial_number` | VARCHAR(64) | nullable | TBD |
| `modbus_slave_id` | SMALLINT | **nullable** — never invent | TBD |
| `ct_primary_a` | DECIMAL | **nullable** | TBD |
| `ct_secondary_a` | DECIMAL | **nullable** | VERIFY |
| `wiring` | ENUM/VARCHAR | `3P4W` etc. nullable | VERIFY |
| `register_map_ref` | VARCHAR(128) | pointer to map doc/version — not addresses | TBD |
| `capability_json` | JSON | Mirrors telemetry capabilities | PROPOSED |
| `status` | ENUM | `planned`,`installed`,`active`,`retired` | PROPOSED |

### 2.4 `load_meter_assignments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `load_id` | UUID | FK |
| `meter_id` | UUID | FK |
| `valid_from` | DATETIME(3) | |
| `valid_to` | DATETIME(3) | nullable = current |

Supports meter replacement without breaking load history (**device management** gap).

### 2.5 `gateways`

| Column | Type | Notes | Class |
|--------|------|-------|-------|
| `id` | UUID | PK | PROPOSED |
| `site_id` | UUID | FK | PROPOSED |
| `code` | VARCHAR(64) | matches telemetry `gateway_id` | PROPOSED |
| `name` | VARCHAR(128) | | TBD |
| `auth_key_hash` | VARCHAR(255) | never store plaintext | PROPOSED |
| `firmware_version` | VARCHAR(64) | nullable | TBD |
| `rs485_master_verified` | BOOL | default false | VERIFY gate |
| `created_at` | DATETIME(3) | | |

### 2.6 `gateway_meter_links`

| Column | Type | Notes |
|--------|------|-------|
| `gateway_id` | UUID | |
| `meter_id` | UUID | |
| `bus_address_note` | VARCHAR(128) | free text — **not** confirmed slave id |  

### 2.7 `users` / `roles` / `user_roles`

| Table | Notes | Class |
|-------|-------|-------|
| `users` | id, email, display_name, password_hash/IdP subject, status | PROPOSED |
| `roles` | `viewer`, `operator`, `admin` seed | PROPOSED |
| `user_roles` | user_id, role_id, site_id (nullable = all sites TBD) | PROPOSED |

Per-action matrix: **TBD**.

### 2.8 `telemetry_samples` — RAW

| Column | Type | Notes | Class |
|--------|------|-------|-------|
| `id` | BIGINT AI | PK | PROPOSED |
| `site_id` | UUID | denormalized | PROPOSED |
| `gateway_id` | UUID | | |
| `meter_id` | UUID | | |
| `load_id` | UUID | | |
| `source_type` | ENUM(`REAL`,`DEMO`) | **required** | PROPOSED |
| `schema_version` | VARCHAR(32) | | PROPOSED |
| `sample_time` | DATETIME(3) | from payload `timestamp` UTC | PROPOSED |
| `received_at` | DATETIME(3) | server | DERIVED |
| `sequence` | BIGINT | | PROPOSED |
| `quality` | ENUM | LIVE/STALE/OFFLINE/UNKNOWN | PROPOSED |
| `active_power_kw` | DECIMAL(12,4) NULL | | |
| `current_a` | DECIMAL(12,4) NULL | | |
| `voltage_v` | DECIMAL(12,4) NULL | | |
| `power_factor` | DECIMAL(8,5) NULL | | |
| `frequency_hz` | DECIMAL(8,4) NULL | | |
| `reactive_power_kvar` | DECIMAL(12,4) NULL | | |
| `apparent_power_kva` | DECIMAL(12,4) NULL | | |
| `active_import_kwh` | DECIMAL(18,4) NULL | cumulative if present | |
| `payload_json` | JSON NULL | optional full sample | PROPOSED |

**Indexes (PROPOSED):**

- UNIQUE `(gateway_id, meter_id, sequence, source_type)`
- `(load_id, source_type, sample_time)`
- `(site_id, source_type, sample_time)`
- `(meter_id, sample_time)`

**Partitioning / retention:** TBD (M-04, P-01). Consider monthly partitions.

### 2.9 `energy_counter_snapshots` — RAW (optional)

If energy is sparse relative to electrical polls, still store counter on each sample via `telemetry_samples.active_import_kwh`. This table is optional for explicit counter-only events.

### 2.10 `derived_load_intervals` — DERIVED

Materialized period rollups — **never** confuse with raw counters.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGINT | PK |
| `load_id` | UUID | |
| `source_type` | ENUM | |
| `interval_start` | DATETIME(3) | UTC |
| `interval_end` | DATETIME(3) | |
| `granularity` | ENUM(`1h`,`1d`,…) | TBD set |
| `energy_kwh` | DECIMAL(18,4) NULL | from counter delta rules |
| `peak_power_kw` | DECIMAL(12,4) NULL | definition depends on demand rules TBD |
| `avg_power_kw` | DECIMAL(12,4) NULL | |
| `valid_samples` | INT | |
| `expected_samples` | INT | |
| `coverage_pct` | DECIMAL(5,2) | |
| `partial_quality` | VARCHAR(32) | e.g. `complete`,`partial`,`empty` |
| `computed_at` | DATETIME(3) | |
| `algorithm_version` | VARCHAR(32) | e.g. `energy_delta_v1` |

**Unique:** `(load_id, source_type, granularity, interval_start)`.

### 2.11 `derived_site_intervals` — DERIVED

Site aggregates with `loads_reporting`, `loads_expected`, sum energy, peak of **aggregated** series (not sum of peaks) — gap analysis §6.

### 2.12 `alarms`

| Column | Type | Notes | Class |
|--------|------|-------|-------|
| `id` | UUID | PK | PROPOSED |
| `site_id` | UUID | | |
| `load_id` | UUID NULL | site-level if null | |
| `meter_id` | UUID NULL | | |
| `type` | VARCHAR(64) | overcurrent, … | PROPOSED |
| `severity` | ENUM | | PROPOSED |
| `status` | ENUM(`active`,`acknowledged`,`cleared`) | | PROPOSED |
| `title` | VARCHAR(255) | | |
| `description` | TEXT | | |
| `threshold_ref` | VARCHAR(64) NULL | link to config — limits TBD | TBD |
| `source_type` | ENUM | | PROPOSED |
| `raised_at` | DATETIME(3) | | |
| `cleared_at` | DATETIME(3) NULL | | |
| `acknowledged_at` | DATETIME(3) NULL | | |
| `acknowledged_by` | UUID NULL | FK users | |

### 2.13 `alarm_transitions` / events

Append-only state changes for audit (ack, clear, re-raise).

### 2.14 `events` (general)

Operational events distinct from alarms: ingest duplicates, sequence gaps, counter reset detected, config change references.

| Column | Notes |
|--------|-------|
| `id`, `site_id`, `severity`, `category`, `message`, `payload_json`, `created_at`, `source_type` | PROPOSED |

### 2.15 `device_comm_status`

Latest communication picture — **not** invented success rates.

| Column | Notes | Class |
|--------|-------|-------|
| `device_type` | `gateway` \| `meter` | PROPOSED |
| `device_id` | UUID | |
| `link_state` | online/degraded/offline/unknown | PROPOSED |
| `last_sample_time` | DATETIME(3) NULL | |
| `last_received_at` | DATETIME(3) NULL | |
| `consecutive_failures` | INT | TBD semantics |
| `updated_at` | DATETIME(3) | |

Default gateway state until proven: `unknown` (**VERIFY** hardware).

### 2.16 `config_settings` / `config_revisions`

| Setting examples | Value class |
|------------------|-------------|
| Serial baud/parity proposal | PROPOSED stored as proposal, not “live config” until commissioned |
| Alarm thresholds | TBD — empty until confirmed |
| Retention days | TBD |
| Stale after seconds | TBD |
| Demand interval seconds | TBD |

`config_revisions`: append-only old value, new value, actor, timestamp (**audit**).

### 2.17 `audit_logs`

| Column | Notes | Class |
|--------|-------|-------|
| `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `at` | Append-only | PROPOSED |
| Immutability / retention | TBD | |

---

## 3. Raw vs derived separation rules

| Layer | Contents | Mutability |
|-------|----------|------------|
| RAW | `telemetry_samples` (+ optional counter table) | Insert-only (corrections via compensating events, not silent edits) |
| DERIVED | `derived_*_intervals`, KPI responses, alarm evaluations | Recomputable from RAW + config `algorithm_version` |
| CONFIG | meters, thresholds, serial proposals | Versioned |

**Forbidden:** updating raw `active_power_kw` to “fix” gaps; storing demo ΣkW-as-kWh into `derived_load_intervals` without `algorithm_version=demo_hourly_sum_v0` and `source_type=DEMO`.

---

## 4. DEMO data in the database

**PROPOSED options** (pick one in Phase 2a):

1. Same tables with `source_type='DEMO'` (simpler queries with mandatory filter).  
2. Parallel `demo_telemetry_samples` (stronger isolation, more schema drift risk).

Recommendation: **option 1** + enforced default scope in repositories.

---

## 5. What is not stored as fact

- Official Modbus register maps as confirmed rows without supplier doc  
- Fabricated CT ratios  
- Fabricated Modbus success %  
- Temperature / pressure / control points  

Nullable columns exist so the System UI can show NOT CONFIGURED without lying.

---

## 6. Volume note (P-01)

At 10 s raw × 4 loads × 30 days ≈ 1M+ rows/metric-set.  
**PROPOSED:** keep raw short retention (TBD); roll up to 1 min / 1 h / 1 d derived tables for Energy page.
