# R1 — Four Meter Sequential Polling Plan

**Prerequisite:** Single‑meter communication **PASS** on J8 / UART2 (see `R1_SINGLE_METER_TEST_PROCEDURE.md`).  
**Do not** begin four‑meter testing before that gate.

---

## 1. Load ↔ meter roles (no slave IDs assigned)

| Load | Capacity label | Proposed meter role | Slave ID |
|------|----------------|---------------------|----------|
| AC‑01 | 5 TR | Dedicated feeder meter | **Unassigned** until physical config confirmed |
| AC‑02 | 5 TR | Dedicated feeder meter | **Unassigned** |
| AC‑03 | 8 TR | Dedicated feeder meter | **Unassigned** |
| Compressor‑01 | Capacity TBD | Dedicated feeder meter | **Unassigned** |

**VERIFIED FROM PROJECT DOCS:** load names/capacities (`frontend/src/config/loads.ts`, R001).  
**TR ≠ kW:** cooling tons must not be converted to electrical power without nameplate data.  
**Slave IDs:** **NOT VERIFIED** — placeholders such as 1–4 in older PROJECT_EMS notes are **PROPOSED only** and must not be treated as Trikona/site truth.

Opaque catalogue `meter_id` / `load_id` in TEST_EMS DB remain separate from Modbus slave IDs.

---

## 2. Bus architecture (PROPOSED)

- Single RS‑485 segment on **J8** (page‑9 port).  
- Unique slave IDs per meter (once configured).  
- Shared A/B (after 2‑wire join verified).  
- One master only (Trikona gateway).  
- End‑of‑bus termination policy TBD after cable length known (gateway already has on‑board 120 Ω per pair — **VERIFIED FROM SCHEMATIC**; multi‑drop loading **NOT VERIFIED**).

---

## 3. Polling sequence (PROPOSED)

1. Poll meter for load AC‑01  
2. Inter‑frame idle (≥ 3.5 character times at configured baud; add margin)  
3. Poll AC‑02  
4. Idle  
5. Poll AC‑03  
6. Idle  
7. Poll Compressor‑01  
8. Cycle delay (`pollInterval` — controller default **1000 ms** is **VERIFIED FROM FIRMWARE** as a setting, not a proven optimum)  
9. Repeat

Prefer **sequential** master requests only — no overlapping transactions on one UART.

---

## 4. Timing / retry / faults (PROPOSED until bench‑tuned)

| Topic | Proposal | Certainty |
|-------|----------|-----------|
| Response timeout | Start 500–1000 ms per request | PROPOSED / **NOT VERIFIED** |
| Retries | 1–2 retries then mark meter missing for that cycle | PROPOSED |
| CRC failure | Discard payload; increment CRC error counter; retry | Required behaviour |
| Modbus exception | Record exception code; do not invent values | Required |
| Missing meter | `quality=OFFLINE` or equivalent; other meters continue | Required |
| Recovery | Next cycle retries normally; no reboot required for single miss | PROPOSED |
| Timestamp | UTC sample time per meter response | Align with `testems.telemetry.v1` |
| Data quality flags | LIVE / STALE / OFFLINE / UNKNOWN per contract | PROPOSED |

Controller firmware exposes `pollInterval` and ModbusMaster error codes (`0xE2` timeout, `0xE1` CRC) — **VERIFIED FROM FIRMWARE** as implementation artifacts in `TRIKONA_CONTROLER_TESTCODE.ino`. Suitability for Elite 103‑2 multi‑drop: **NOT VERIFIED**.

---

## 5. Register read set

**BLOCKED** until `SECURE_ELITE_103_2_REGISTER_VERIFICATION.md` is cleared.

Do not copy TrackSo or third‑party maps. Per‑meter address lists must come from the official Secure Meters document and the same FC/word‑order/scaling for all four units unless nameplates differ.

---

## 6. Mapping into TEST_EMS telemetry (documentation only)

After verified decode, gateway emits `source_type: "REAL"` samples into `testems.telemetry.v1`:

- `electrical.active_power_kw`, `current_a`, `voltage_v`, `power_factor`, …  
- `energy.active_import_kwh` only after R029 cleared  
- `meter_id` / `load_id` opaque — **not** slave ID  
- Never mix DEMO and REAL in one batch  

Phase 2a backend: contract validator exists; **HTTP ingest route not registered** — **VERIFIED FROM PROJECT DOCS**. No fake REAL rows.

---

## 7. Exit criteria for four‑meter R1

| ID | Criterion |
|----|-----------|
| F1 | Four unique slave IDs confirmed on meters |
| F2 | Sequential poll completes without bus lockup |
| F3 | Each meter CRC‑valid responses under timeout budget |
| F4 | One meter unplugged → others still update |
| F5 | Display spot‑check per meter for mapped quantities |
| F6 | No REAL database writes without official scaling |
