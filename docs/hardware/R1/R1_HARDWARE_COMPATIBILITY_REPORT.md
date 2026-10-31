# R1 Hardware Compatibility Report — Trikona COM Port × Secure Elite 103‑2

**Project:** TEST_EMS (`B:\TEST_EMS`)  
**Date:** 2026-10-31  
**Type:** AUDIT AND DOCUMENTATION ONLY  
**No firmware flash, no backend/frontend/schema changes, no invented registers.**

### Reference schematic

| Item | Status |
|------|--------|
| Requested | `TRIKONA_BOARD_CKT_DIAGRAM(20261031-050158).pdf` |
| Found | **NOT FOUND** |
| Used | `docs/hardware/reference/TRIKONA_BOARD_CKT_DIAGRAM.pdf` (copy of Ellcrafts/test_code board PDF, 165 454 bytes, 9 pages) |
| Focus page | **Page 9** — UART2, U19, U20, U23, dual SN65HVD3085E, J8/CON8, `RS485_2_*` |

Companion docs in this folder: signal mapping, connector pinout, Elite register verification, single/four meter plans, acceptance checklist, blockers.

---

## 1. Executive verdicts

| # | Topic | Verdict |
|---|-------|---------|
| 1 | Exact COM / UART2 hardware signal path (page 9) | **Documented — VERIFIED FROM SCHEMATIC** (see §3) |
| 2 | UART2 pin mapping (ESP32 balls) | Package labels IO17/IO16 **VERIFIED FROM SCHEMATIC**; firmware uses **TX=16, RX=34** (**VERIFIED FROM FIRMWARE**); physical net continuity **NOT VERIFIED** |
| 3 | RS485 connector wiring (J8) | **VERIFIED FROM SCHEMATIC** — pins 1–8 labelled; TX on 4/5, RX on 7/8 |
| 4 | Two‑wire RS485 feasibility | **CONDITIONAL / NOT VERIFIED** — separate TX & RX differential nets; join not proven |
| 5 | Modbus RTU Master firmware | **PARTIALLY IMPLEMENTED** (controller testcode); wifi‑config tree **NOT IMPLEMENTED** for Modbus; live Elite proof **NOT VERIFIED** |
| 6 | Secure Elite register map | **NOT VERIFIED / BLOCKED** |
| 7 | Single‑meter test readiness | **NOT READY** — blockers B02–B06 |
| 8 | Four‑meter readiness | **NOT READY** — gated on single‑meter PASS |
| 9 | Backend ingest of REAL samples | Contract exists; Phase 2a ingest **not registered** — documentation mapping only |

---

## 2. Port naming conflict (mandatory)

Task brief asserts **COM2** = UART2 / GPIO17&16 / J8 / U20 / `RS485_2_*`.

| Port (firmware name) | UART | TX / RX GPIOs (FW) | Connector | Mux | Differential nets | Schematic page |
|----------------------|------|--------------------|-----------|-----|-------------------|----------------|
| COM1 | UART0 | 1 / 3 | J11 | U38 | `RS485_*` | 5 |
| **COM2** | **UART1** | **32 / 35** | **J10** | **U27** | **`RS485_1_*`** | **8** |
| **COM3** | **UART2** | **16 / 34** | **J8** | **U20** | **`RS485_2_*`** | **9** |

**Sources:** `serial_manager.cpp` header comments; `TRIKONA_CONTROLER_TESTCODE.ino` (`COM2 = UART1`, `COM3 = UART2`); schematic pages 5/8/9.

**Implication:** The **parts list in the brief matches page 9 / firmware COM3**, not firmware COM2.  
**BLOCKED** until stakeholder confirms which name wins. These R1 docs trace **page 9 / J8 / UART2 / RS485_2** and note firmware’s **COM3** label.

Also: controller firmware defines `ETH_CLOCK_GPIO17_OUT` — using GPIO17 as UART2_TX in the same image is **risky / conflicting** (**VERIFIED FROM FIRMWARE**).

---

## 3. Exact page‑9 signal path

### TX

`UART2_TX` → **U23** (6N137) → **U20** (74HC4052) → `TXD2_485` → **SN65HVD3085E (U17)** → `RS485_2_TX_A_EXT` / `RS485_2_TX_B_EXT` → **J8 pins 4 / 5** (`RS485_A/RS422_TX+`, `RS485_B/RS422_TX-`).

### RX

**J8 pins 7 / 8** (`RS422_RX+` / `RS422_RX-`) → `RS485_2_RX_A_EXT` / `RS485_2_RX_B_EXT` → **SN65HVD3085E (U13)** → `RXD2_485H` → **U20** → **U19** (6N137) → `UART2_RX`.

### Control

- Mode select: MCP23S08 **U9** GP3/GP2 → `U3_SEL_A/B` → U20 (**VERIFIED FROM SCHEMATIC** page 7 + **FIRMWARE**).  
- DE/RE: tied on transceiver; CD4069 assist; firmware treats direction as **HW‑Auto** while keeping RS485 mux path selected (**VERIFIED FROM SCHEMATIC** + **FIRMWARE**).  
- Isolation: `VCC_3V3`/GND vs `VCC_5V_ISO`/isolated GND (**VERIFIED FROM SCHEMATIC**).

Full detail: `COM2_UART2_RS485_SIGNAL_MAPPING.md`.

---

## 4. Two‑wire Modbus RTU feasibility

| Observation | Certainty |
|-------------|-----------|
| Dual SN65 drivers — separate TX and RX pairs | **VERIFIED FROM SCHEMATIC** |
| Connector exposes TX on 4/5 and RX on 7/8 | **VERIFIED FROM SCHEMATIC** |
| On‑PCB join of TX↔RX pairs | **NOT VERIFIED** |
| TTL mux X1–X2 jumper | **VERIFIED FROM SCHEMATIC** — does not replace differential join |

**Verdict:** Intended 2‑wire Elite bus is **not proven** without either external shorts (4↔7, 5↔8) or a verified PCB join. **Do not mark PASS** for half‑duplex wiring until continuity is done.

---

## 5. Firmware audit summary

### 5.1 Sources inspected

| Source | Role |
|--------|------|
| `C:\Users\YUVA\Downloads\TRIKONA_CONTROLER_TESTCODE\TRIKONA_CONTROLER_TESTCODE.ino` | Production‑style controller with **ModbusMaster** |
| `B:\test_code\trikona_gateway_ide_clean\trikona_wifi_config_test\serial_manager.cpp` | Serial/mux management, loopback/diag — **no ModbusMaster** |

### 5.2 Feature matrix

| Feature | Controller `.ino` | wifi_config `serial_manager` | Verdict |
|---------|-------------------|------------------------------|---------|
| UART2 init | Yes (`Serial2`, RX34/TX16) | Yes (COM3) | **VERIFIED FROM FIRMWARE** |
| GPIO17 as UART2_TX | No (ETH clock) | No | Brief claim **NOT VERIFIED** / conflict |
| COM / mode select via MCP23S08 | Yes | Yes | **VERIFIED FROM FIRMWARE** |
| 74HC4052 select patterns | Yes (RS232/RS485/GSM) | Yes (+ RS422) | **VERIFIED FROM FIRMWARE** |
| RS485 DE/RE GPIO | Mode bits / HW‑Auto comments | HW‑Auto comments | **PARTIALLY** — no classic DE GPIO |
| Baud config | Per‑COM NVS/UI | NVS | **VERIFIED FROM FIRMWARE** |
| Serial TX/RX handling | Yes | Yes (test vectors) | **VERIFIED FROM FIRMWARE** |
| Modbus RTU master | **Yes** (`ModbusMaster` node1/node2, FC 1–4, poll loop, write path) | **No matches** | Controller: **IMPLEMENTED** (code present). wifi_config: **NOT IMPLEMENTED**. Elite on bus: **NOT VERIFIED** |
| CRC16 | Via ModbusMaster (`0xE1` CRC mismatch surfaced in UI text) | N/A | **VERIFIED FROM FIRMWARE** as library behaviour — **NOT PHYSICALLY TESTED** |
| Response timeout | Library + UI (`0xE2`) | Frame timeouts for serial test only | **PARTIALLY IMPLEMENTED** |
| Modbus exceptions | Library result codes | N/A | **PARTIALLY IMPLEMENTED** |

### 5.3 Overall Modbus RTU Master verdict

**PARTIALLY IMPLEMENTED**

- Evidence of a configurable RTU master exists in `TRIKONA_CONTROLER_TESTCODE.ino`.  
- Evidence does **not** prove it is the binary currently on the R1 gateway, nor that it talks to Elite 103‑2.  
- Presence of RS485 silicon ≠ completed Modbus integration (**explicitly not assumed**).

---

## 6. Secure Elite 103‑2

See `SECURE_ELITE_103_2_REGISTER_VERIFICATION.md`.

| Topic | Status |
|-------|--------|
| Model / CAT on hand | **NOT VERIFIED** |
| Official register map | **NOT VERIFIED / BLOCKED** |
| Serial settings | **NOT VERIFIED** |
| TrackSo | No configs found — do not use as Trikona truth |

---

## 7. TEST_EMS load mapping (proposed, no slave IDs)

| Load | Capacity | Meter role | Slave ID |
|------|----------|------------|----------|
| AC‑01 | 5 TR | 1:1 feeder meter | Unassigned |
| AC‑02 | 5 TR | 1:1 feeder meter | Unassigned |
| AC‑03 | 8 TR | 1:1 feeder meter | Unassigned |
| Compressor‑01 | TBD | 1:1 feeder meter | Unassigned |

**VERIFIED FROM PROJECT DOCS.** TR is not electrical kW.

---

## 8. Backend / telemetry (no code changes)

- Contract: `docs/telemetry-contract-v1.md` → engineering units + `source_type` REAL|DEMO.  
- Phase 2a: validator present; **ingest HTTP route not registered**.  
- Operational reads filter REAL; DEMO not allowed on ops routes.  
- Mapping path: verified Modbus decode → contract fields → future ingest. **No fake REAL data.**

---

## 9. Readiness

| Stage | Ready? | Why |
|-------|--------|-----|
| Schematic understanding (page 9) | **Yes (documentation)** | Path traced with certainty labels |
| Single‑meter lab | **No** | Naming, GPIO, 2‑wire join, register map, physical test outstanding |
| Four‑meter poll | **No** | Gated on single‑meter PASS |
| REAL production telemetry | **No** | Map + ingest + physical proof outstanding |

---

## 10. Exact next action for R1

1. **Decide in writing:** Is the meter bus on **J8 / UART2** (firmware **COM3**, brief parts list) or **J10 / UART1** (firmware **COM2**)?  
2. If J8: perform **continuity** of TX/RX pair join and **UART2_TX/RX → GPIO** mapping on the assembled board.  
3. Obtain **official Elite 103‑2 Modbus register map**.  
4. Run `R1_SINGLE_METER_TEST_PROCEDURE.md` only after steps 1–3.  
5. **Stop** — wait for approval before any firmware/backend implementation.

---

## 11. Document index

| File | Purpose |
|------|---------|
| `R1_HARDWARE_COMPATIBILITY_REPORT.md` | This summary |
| `COM2_UART2_RS485_SIGNAL_MAPPING.md` | Full TX/RX/DE/RE/isolation trace |
| `COM2_CONNECTOR_PINOUT.md` | J8/CON8 pins |
| `SECURE_ELITE_103_2_REGISTER_VERIFICATION.md` | Meter map status |
| `R1_SINGLE_METER_TEST_PROCEDURE.md` | Safe one‑meter lab plan |
| `R1_FOUR_METER_POLLING_PLAN.md` | Sequential multi‑drop plan |
| `R1_ACCEPTANCE_CHECKLIST.md` | Pass/fail gates |
| `R1_BLOCKERS_AND_RISKS.md` | Blockers B01–B08 |

Rendered schematic page extracts: `docs/hardware/reference/schematic-pages/`.
