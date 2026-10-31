# R1 Blockers and Risks

**Date:** 2026-10-31  
**Audit only — no implementation performed.**

---

## 1. Blockers (must clear before claiming R1 hardware PASS)

| ID | Blocker | Impact | Required action |
|----|---------|--------|-----------------|
| B01 | Requested schematic filename `TRIKONA_BOARD_CKT_DIAGRAM(20261031-050158).pdf` **not found** | Traceability of “exact” revision | Locate dated PDF or formally accept April‑dated `TRIKONA_BOARD_CKT_DIAGRAM.pdf` used in audit |
| B02 | **COM naming conflict:** brief “COM2 + UART2 + J8” vs firmware **COM2=UART1/J10**, **COM3=UART2/J8** | Wrong connector / wrong UART if miswired | Stakeholder written decision: target **J8/UART2** (FW COM3) or **J10/UART1** (FW COM2) |
| B03 | Brief GPIO17 TX / GPIO16 RX vs firmware UART2 **TX16/RX34**; GPIO17 used for ETH clock in controller FW | Pin mux / Ethernet conflict risk | Continuity test + pin‑map freeze |
| B04 | Separate `RS485_2_TX_*` and `RS485_2_RX_*` pairs; 2‑wire join **not proven** | Half‑duplex Modbus may fail if only pins 4–5 used | Continuity / jumper procedure; update pinout doc with PHYSICALLY TESTED result |
| B05 | Official Secure Elite 103‑2 **Modbus register map absent** | Cannot decode/scaling; cannot fill REAL energy | Obtain Secure Meters / ConfigView official map |
| B06 | Meter site serial settings (ID/baud/parity/stop) **not confirmed** | Master config guesswork | Read meter / commissioning sheet |
| B07 | No **PHYSICALLY TESTED** Modbus exchange in this audit | Cannot mark communication PASS | Execute single‑meter procedure |
| B08 | Phase 2a **ingest route not live**; REAL path incomplete | Backend cannot store live samples yet | Future implementation (out of this audit scope) |

---

## 2. Risks (non-blocking but high)

| ID | Risk | Mitigation |
|----|------|------------|
| R01 | Using wifi‑config firmware without ModbusMaster for meter polls | Select controller build that includes RTU master **or** add Modbus later (implementation needs approval) |
| R02 | On‑board 120 Ω on **both** TX and RX pairs + multi‑drop meters → over‑termination | Measure; adjust end‑of‑line strategy |
| R03 | Isolation ground vs meter 0 V bonding errors | Follow meter manual; isolation‑aware earthing |
| R04 | Treating TR cooling capacity as kW | Forbidden — electrical power from meters only |
| R05 | Copying TrackSo / third‑party register maps | Rejected until official doc |
| R06 | Labelling DEMO UI data as REAL | Keep `source_type` separation |
| R07 | Opening CT secondaries under load | Qualified personnel only; never recommend |
| R08 | Confusing J11 / J10 / J8 (all may say CON8) | Identify by J‑number + schematic page |

---

## 3. Missing documents checklist

1. `TRIKONA_BOARD_CKT_DIAGRAM(20261031-050158).pdf` (if different from audited PDF)  
2. Secure Elite 103‑2 official Modbus register map  
3. Secure Elite datasheet PDF on file  
4. Meter nameplate / PO evidence  
5. Site commissioning sheet (slave IDs, serial params, CT ratios)  
6. Assembled‑board continuity report (UART nets, TX/RX pair joins)  
7. Signed decision on COM2 vs COM3 naming for J8  

---

## 4. Exact next action required for R1

**Resolve B02 in writing** (which physical port is in scope), then perform **continuity of TX/RX pair join (B04)** and **GPIO net verification (B03)** on the assembled gateway **before** any energised Modbus claims. In parallel, **obtain the official Elite register map (B05)**. Only then run `R1_SINGLE_METER_TEST_PROCEDURE.md`.
