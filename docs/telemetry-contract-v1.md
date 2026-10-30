# TEST_EMS Telemetry Contract v1

**Status:** PROPOSED  
**Schema version:** `testems.telemetry.v1`  
**Owner:** TEST_EMS (independent project — does not claim reuse of any Trikona/PROJECT_EMS ingest until X-01 is decided)  
**Hardware verification:** None. This contract does **not** invent Modbus register addresses, scaling, CT ratios, or meter capabilities.

Related: [phase-1.5-architecture-audit.md](phase-1.5-architecture-audit.md), [database-design-v1.md](database-design-v1.md)

---

## 1. Purpose

Define a versioned JSON payload that a gateway (or lab simulator) posts to the future backend so that:

1. Raw electrical observations are stored without fabrication.
2. Optional measurements may be omitted or null.
3. DEMO and REAL sources never mix in the same logical stream without an explicit `source_type`.
4. Downstream services can derive energy, demand, coverage, and alarms.

---

## 2. Transport (PROPOSED)

| Item | Proposal | Class |
|------|----------|-------|
| Protocol | HTTPS `POST /api/v1/ingest/telemetry` | PROPOSED |
| Content-Type | `application/json` | PROPOSED |
| Auth | Per-gateway credential (API key or mTLS) | TBD |
| Batching | Single sample or `samples[]` array (max size TBD) | PROPOSED |
| Alternate | MQTT topic — not selected | TBD (X-01 / gateway link) |

---

## 3. Envelope

```json
{
  "schema_version": "testems.telemetry.v1",
  "source_type": "REAL",
  "gateway_id": "gw_01",
  "sent_at": "2026-10-30T06:15:00.000Z",
  "samples": [
    {
      "meter_id": "mtr_ac03",
      "load_id": "load_ac03",
      "load_code": "AC-03",
      "timestamp": "2026-10-30T06:14:58.000Z",
      "sequence": 184422,
      "quality": "LIVE",
      "electrical": {
        "active_power_kw": 4.91,
        "current_a": 8.82,
        "voltage_v": 416.0,
        "power_factor": 0.93,
        "frequency_hz": 49.95,
        "reactive_power_kvar": null,
        "apparent_power_kva": null,
        "voltage_l1_v": null,
        "voltage_l2_v": null,
        "voltage_l3_v": null,
        "current_l1_a": null,
        "current_l2_a": null,
        "current_l3_a": null
      },
      "energy": {
        "active_import_kwh": 12543.28,
        "active_import_raw": null,
        "counter_unit": "kWh"
      },
      "capabilities": {
        "reports_energy_import": true,
        "reports_per_phase": false,
        "reports_reactive": false,
        "reports_thd": false
      },
      "meta": {
        "poll_attempt": 1,
        "rssi": null,
        "notes": null
      }
    }
  ]
}
```

`received_at` is **not** supplied by the gateway; the API stamps it on ingest (**DERIVED** server-side).

---

## 4. Field dictionary

### 4.1 Envelope fields

| Field | Type | Required | Class | Notes |
|-------|------|----------|-------|-------|
| `schema_version` | string | yes | PROPOSED | Must equal `testems.telemetry.v1` for this doc |
| `source_type` | `"REAL"` \| `"DEMO"` | yes | PROPOSED | Separation rule — see §7 |
| `gateway_id` | string | yes | PROPOSED | Opaque id provisioned in backend |
| `sent_at` | string (ISO-8601 UTC) | yes | PROPOSED | Gateway clock; may skew |
| `samples` | array | yes | PROPOSED | Length ≥ 1; max TBD |

### 4.2 Sample fields

| Field | Type | Required | Class | Notes |
|-------|------|----------|-------|-------|
| `meter_id` | string | yes | PROPOSED | Opaque; not a Modbus slave id |
| `load_id` | string | yes | PROPOSED | Opaque FK to loads |
| `load_code` | string | no | CONFIRMED codes exist | Display code e.g. `AC-01`; optional denormalization |
| `timestamp` | string (ISO-8601 UTC) | yes | PROPOSED | Sample time at meter/gateway (who stamps — TBD R023) |
| `sequence` | integer ≥ 0 | yes | PROPOSED | Monotonic per `(gateway_id, meter_id)` for duplicate / reorder detection |
| `quality` | `"LIVE"` \| `"STALE"` \| `"OFFLINE"` \| `"UNKNOWN"` | yes | PROPOSED | Gateway-declared; server may override using age rules when thresholds confirmed |
| `electrical` | object | yes | — | Keys optional / nullable |
| `energy` | object | no | — | Omit entirely if meter does not report energy |
| `capabilities` | object | no | PROPOSED | Lets UI gate advanced params without inventing registers |
| `meta` | object | no | PROPOSED | Non-electrical diagnostics |

### 4.3 Electrical measurements (all optional)

Omit key **or** set `null` if not reported. **Never fabricate.**

| Field | Unit | Class |
|-------|------|-------|
| `active_power_kw` | kW | VERIFY availability |
| `current_a` | A (average or total — definition TBD) | VERIFY |
| `voltage_v` | V (system / average — definition TBD) | VERIFY |
| `power_factor` | dimensionless (−1…1 or 0…1 — sign convention VERIFY) | VERIFY |
| `frequency_hz` | Hz | VERIFY |
| `reactive_power_kvar` | kVAr | VERIFY |
| `apparent_power_kva` | kVA | VERIFY |
| `voltage_l1_v` … `voltage_l3_v` | V | VERIFY / capability |
| `current_l1_a` … `current_l3_a` | A | VERIFY / capability |

**Not in v1 contract (FUTURE / out of scope):** temperature, pressure, compressor loaded status, control commands.

### 4.4 Energy object

| Field | Unit | Required | Class | Notes |
|-------|------|----------|-------|-------|
| `active_import_kwh` | kWh | if energy present | VERIFY | Cumulative import preferred for delta math |
| `active_import_raw` | number | no | TBD | Unscaled raw if needed later — **no scaling invented here** |
| `counter_unit` | string | if energy present | PROPOSED | `"kWh"` only until VERIFY says otherwise |

Export / net / gross: **not displayed** (gap analysis) — omit from v1.

---

## 5. Units

| Quantity | Storage unit | Display |
|----------|--------------|---------|
| Active power | kW | kW |
| Current | A | A |
| Voltage | V | V |
| Power factor | 1 | 2–3 decimal places |
| Frequency | Hz | Hz |
| Energy | kWh | kWh |
| Timestamps | UTC ISO-8601 with `Z` | IST for UI (**PROPOSED** R040) |

---

## 6. Null and omission handling

| Case | Rule |
|------|------|
| Measurement not supported | Omit key **or** `null`; set `capabilities.* = false` when known |
| Transient read failure | Prefer omit sample **or** sample with `quality: "OFFLINE"` and nulls — **TBD** gateway policy |
| Server persistence | Store SQL `NULL`; do not coerce to `0` |
| Charts | Render gaps; **no power interpolation** (gap analysis §6) |
| Aggregates | Exclude nulls; annotate `n of m reporting` |

**Violation:** treating missing as zero (current demo analytics does this — must not carry into REAL pipeline).

---

## 7. DEMO versus REAL separation

| Rule | Detail | Class |
|------|--------|-------|
| Explicit `source_type` | Required on every envelope | PROPOSED |
| Storage | Prefer separate tables **or** mandatory column with check constraint; never default REAL | PROPOSED |
| API reads | Default filter `source_type=REAL` for operational views; DEMO only when requested or env=`demo` | PROPOSED |
| UI | If any DEMO row is shown, global DEMO banner required | CONFIRMED design rule |
| Mixing | Reject batch that mixes REAL and DEMO samples in one envelope | PROPOSED |

---

## 8. Validation (server)

**PROPOSED** checklist on ingest:

1. `schema_version` supported.
2. `source_type` ∈ {REAL, DEMO}.
3. `gateway_id` known and credential matches.
4. Each `meter_id` / `load_id` assigned to that gateway/site.
5. `timestamp` parseable UTC; reject if > skew_future_max ahead of server (**TBD** e.g. 5 min).
6. `sequence` integer ≥ 0.
7. Numeric fields finite; PF in configured range (**TBD**); reject NaN/Inf.
8. If `energy` present, `active_import_kwh` ≥ 0 and finite.
9. Unknown keys: ignore (forward compatible) **or** strip — choose ignore (**PROPOSED**).

Validation **does not** check Modbus register correctness — that is firmware/bench VERIFY.

---

## 9. Duplicate detection

| Key | Rule | Class |
|-----|------|-------|
| Primary idempotency | `(gateway_id, meter_id, sequence)` unique | PROPOSED |
| Alternate | `(gateway_id, meter_id, timestamp)` unique if sequence unavailable | TBD |
| On duplicate | HTTP 200 with `duplicate: true`; no double insert | PROPOSED |
| Energy side effect | Do not apply counter delta twice | DERIVED |

---

## 10. Out-of-order samples

| Rule | Class |
|------|-------|
| Accept samples with `timestamp` older than latest if within reorder_window (**TBD**) | PROPOSED |
| Persist raw row regardless of order | PROPOSED |
| Derived rollups recompute or use incremental logic tolerant of late data | TBD |
| Sequence gap → communication event, not silent fill | PROPOSED |

---

## 11. Timestamp handling

| Clock | Role | Class |
|-------|------|-------|
| `timestamp` | Event time for series / energy bounds | PROPOSED (source R023 TBD) |
| `sent_at` | Gateway batch time | PROPOSED |
| `received_at` | Server ingest time | DERIVED |
| Storage | UTC | PROPOSED |
| Display | IST | PROPOSED |
| Period boundaries | IST calendar days for “today” / “month” until billing-day TBD | PROPOSED |

If gateway lacks NTP, document clock quality in `meta` — **TBD**.

---

## 12. What this contract deliberately excludes

- Modbus register addresses, function codes, word order, scaling factors  
- CT ratio fields (configure on meter/device record — TBD values)  
- Assumed Elite 103-2 capability bits beyond what `capabilities` reports at runtime  
- Control / write coils  
- Cost / tariff fields  

---

## 13. Versioning

| Change type | Action |
|-------------|--------|
| Add optional field | Compatible; keep `testems.telemetry.v1` |
| Change unit or meaning | Bump to `v2`; dual-read period |
| Remove field | Bump major |

---

## 14. Minimal acceptance example (DEMO simulator)

A lab simulator may post `source_type: "DEMO"` with the same schema to exercise the pipeline without implying hardware success. UI must show DEMO DATA.
