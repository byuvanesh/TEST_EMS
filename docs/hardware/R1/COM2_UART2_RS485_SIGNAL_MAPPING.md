# COM2 / UART2 / RS485 Signal Mapping

**Project:** TEST_EMS  
**Date:** 2026-10-31  
**Status:** AUDIT ONLY — no firmware/hardware changes  
**Schematic reference used:** `docs/hardware/reference/TRIKONA_BOARD_CKT_DIAGRAM.pdf`  
**Note on filename:** Requested file `TRIKONA_BOARD_CKT_DIAGRAM(20261031-050158).pdf` was **not found** on disk. The identical-size board PDF `TRIKONA_BOARD_CKT_DIAGRAM.pdf` (165 454 bytes) from `B:\ELLCRAFTS_FOLDER\...\trikona_ckt\` / `B:\test_code\` was used and copied into `docs/hardware/reference/`.

Certainty labels used below: **VERIFIED FROM SCHEMATIC** | **VERIFIED FROM FIRMWARE** | **NOT VERIFIED** | **BLOCKED** | **PHYSICALLY TESTED** (none in this audit).

---

## 1. Critical naming conflict (read first)

| Claim | Source | Result |
|-------|--------|--------|
| “COM2 = ESP32 UART2, GPIO17 TX, GPIO16 RX, J8, U20, RS485_2_*” | R1 task brief | **Conflicts with firmware + prior schematic port map** |
| COM2 = UART1 / Serial1, TX=GPIO32, RX=GPIO35, connector **J10**, mux **U27**, nets `RS485_1_*` | Firmware `serial_manager.cpp`, controller `.ino` | **VERIFIED FROM FIRMWARE** |
| UART2 / Serial2, TX=GPIO16, RX=GPIO34, connector **J8**, mux **U20**, nets `RS485_2_*`, optos **U23/U19** | Schematic page 9 + firmware | **VERIFIED FROM SCHEMATIC** + **VERIFIED FROM FIRMWARE** — firmware names this port **COM3**, not COM2 |
| ESP32 package alternate labels `U2TXD/IO17`, `U2RXD/IO16` | Schematic page 1 | **VERIFIED FROM SCHEMATIC** as **package pin names** — does **not** by itself prove board nets `UART2_TX`/`UART2_RX` attach to those balls |
| GPIO17 used as Ethernet RMII clock (`ETH_CLOCK_GPIO17_OUT`) | Controller firmware | **VERIFIED FROM FIRMWARE** — conflicts with using GPIO17 as UART2_TX in the same build |

**R1 working decision for these docs:** Document the **page‑9 physical circuit** (UART2 / J8 / U20 / U19 / U23 / `RS485_2_*`) as the intended meter interface named in the task parts list, while clearly labelling firmware’s name for that port as **COM3**. Do **not** silently call it COM2 in wiring instructions without stakeholder confirmation.

**BLOCKED:** Final “use COM2 only / do not use COM3” wording until COM port naming is reconciled with the schematic/firmware map.

---

## 2. Page‑9 physical path (UART2 / J8 / RS485_2)

**Source:** Schematic page 9 (rotated 90° in PDF). Rendered extracts under `docs/hardware/reference/schematic-pages/`.

### 2.1 Transmit path (ESP32 → connector)

| Stage | Designator / net | Evidence |
|-------|------------------|----------|
| ESP32 UART2 TX net | `UART2_TX` | **VERIFIED FROM SCHEMATIC** (pages 1 & 9) |
| Optocoupler TX | **U23** 6N137 | **VERIFIED FROM SCHEMATIC** (page 9) |
| Isolated mux TX common | **U20** 74HC4052 X common (`U2TX_O` / `TX2_LED`) | **VERIFIED FROM SCHEMATIC** (page 9) |
| RS485 TX logic into driver | `TXD2_485` → SN65HVD3085E **U17** pin D | **VERIFIED FROM SCHEMATIC** (page 9) |
| Differential TX out | `RS485_2_TX_A_EXT`, `RS485_2_TX_B_EXT` via 10 Ω (R74/R76) | **VERIFIED FROM SCHEMATIC** (page 9) |
| Connector | **J8 / CON8** pins **4 / 5** labelled `RS485_A/RS422_TX+`, `RS485_B/RS422_TX-` | **VERIFIED FROM SCHEMATIC** (page 9) — see pinout doc |

### 2.2 Receive path (connector → ESP32)

| Stage | Designator / net | Evidence |
|-------|------------------|----------|
| Connector RX pair | J8 pins **7 / 8** `RS422_RX+` / `RS422_RX-` | **VERIFIED FROM SCHEMATIC** |
| Differential RX in | `RS485_2_RX_A_EXT`, `RS485_2_RX_B_EXT` via 10 Ω (R60/R66) | **VERIFIED FROM SCHEMATIC** |
| RS485 RX transceiver | Second SN65HVD3085E (**U13** region on page 9) | **VERIFIED FROM SCHEMATIC** |
| Logic RX into mux | `RXD2_485H` (and separate `RXD2_422` path) | **VERIFIED FROM SCHEMATIC** |
| Mux Y common | U20 → `U2RX_O` / `RX2_LED` | **VERIFIED FROM SCHEMATIC** |
| Optocoupler RX | **U19** 6N137 → net `UART2_RX` | **VERIFIED FROM SCHEMATIC** |
| ESP32 UART2 RX | `UART2_RX` | **VERIFIED FROM SCHEMATIC** as net name; **GPIO ball attachment = NOT VERIFIED without continuity** (firmware uses GPIO34) |

### 2.3 Mode selection (74HC4052 U20)

| Item | Value | Certainty |
|------|-------|-----------|
| Mux IC | U20 74HC4052 | **VERIFIED FROM SCHEMATIC** (page 9) |
| Select nets | `U3_SEL_A`, `U3_SEL_B` (10 kΩ pull-ups to `VCC_5V_ISO`) | **VERIFIED FROM SCHEMATIC** |
| Select driven by | Mode MCP23S08 **U9** GP3/GP2 via page 7 | **VERIFIED FROM SCHEMATIC** (page 7 labels) + **VERIFIED FROM FIRMWARE** (`serial_manager.cpp` COM3 → GP3/GP2) |
| Observed channel nets | GSM; `TXD2_485` / `RXD2_485H`; `RXD2_422`; `TXD2_232` / `RXD2_232` | **VERIFIED FROM SCHEMATIC** (partial channel labels visible) |
| RS485 select pattern in FW | SEL bits `01` (A=1,B=0 → channel 1) for RS485 | **VERIFIED FROM FIRMWARE**; channel-to-net assignment match = **VERIFIED FROM SCHEMATIC** in prior mux audit (X1/Y1 RS485; X1–X2 jumpered on TTL side) |

### 2.4 DE / RE

| Item | Finding | Certainty |
|------|---------|-----------|
| Transceiver DE & RE pins | Tied together on each SN65HVD3085E | **VERIFIED FROM SCHEMATIC** (page 9 labels DE/RE adjacent on U17/U13) |
| Auto direction assist | CD4069 / RC network associated with DE/RE path | **VERIFIED FROM SCHEMATIC** (CD4069 U14B/U14C present on page 9) |
| ESP32 direct DE GPIO | None for this port | **VERIFIED FROM FIRMWARE** (`serial_manager.cpp` comment: DE/RE HW-Auto via CD4069/RC; Mode MCP only selects path) |
| Firmware pre/post TX hooks | Re-assert RS485 mux mode bits; do not toggle a dedicated DE pin | **VERIFIED FROM FIRMWARE** (`UART2_TX_ENABLE` / `rs485TxEnable`) |

### 2.5 Isolation / grounding

| Item | Finding | Certainty |
|------|---------|-----------|
| Logic side | `VCC_3V3` / system GND on MCU side of U23/U19 | **VERIFIED FROM SCHEMATIC** |
| Isolated side | `VCC_5V_ISO` and isolated ground symbol (‘F’) for mux, SN65, bias, TVS | **VERIFIED FROM SCHEMATIC** |
| Bias / termination on each differential pair | 4.7 kΩ bias + 120 Ω termination present on TX and RX pairs | **VERIFIED FROM SCHEMATIC** |
| Surge protection | SM712 on TX and RX pairs | **VERIFIED FROM SCHEMATIC** |

---

## 3. Two-wire RS485 feasibility

| Question | Finding | Certainty |
|----------|---------|-----------|
| Are TX and RX differential paths separate nets? | Yes — `RS485_2_TX_*_EXT` vs `RS485_2_RX_*_EXT` | **VERIFIED FROM SCHEMATIC** |
| Do connector pins 4/5 alone expose both driver and receiver? | Pins 4/5 are labelled TX/RS485 A/B; pins 7/8 are RX. Separate EXT nets sit adjacent to those pin groups. | **VERIFIED FROM SCHEMATIC** |
| Is an on-PCB short of TX↔RX pairs proven? | No shared net name joining TX_A↔RX_A or TX_B↔RX_B found in this audit | **NOT VERIFIED** |
| External join for 2-wire Modbus? | Likely required: join **A** (pin4 ↔ pin7) and **B** (pin5 ↔ pin8), or meter wired to both pairs correctly — **must be continuity-checked** | **NOT VERIFIED** / **BLOCKED** until continuity test |
| TTL-side mux X1–X2 jumper | Present on mux (RS485/RS422 channel link) — does **not** replace differential TX/RX join | **VERIFIED FROM SCHEMATIC** (prior mux audit) |

**Verdict:** Two-wire half-duplex Modbus RTU is **not proven plug-and-play on pins 4 & 5 alone**. Treat as **CONDITIONAL — external TX/RX pair joining or proven PCB join required**. **NOT PHYSICALLY TESTED.**

---

## 4. Firmware GPIO map for the page‑9 UART (named COM3 in FW)

| Item | Firmware value | Certainty |
|------|----------------|-----------|
| Port name | COM3 | **VERIFIED FROM FIRMWARE** |
| UART | UART2 / `Serial2` | **VERIFIED FROM FIRMWARE** |
| TX GPIO | **16** | **VERIFIED FROM FIRMWARE** |
| RX GPIO | **34** | **VERIFIED FROM FIRMWARE** |
| Default baud (RS485) | 9600 8N1 | **VERIFIED FROM FIRMWARE** |
| Task brief GPIO17/16 | Conflicts with firmware and with ETH clock on 17 | **BLOCKED** — do not flash assumptions |

---

## 5. Trace summary diagram (logical)

```
ESP32 UART2_TX ──► U23 6N137 ──► U20 74HC4052 (TX) ──► TXD2_485
                                                      │
                                                      ▼
                                              SN65HVD3085E (U17)
                                                      │
                                      RS485_2_TX_A/B_EXT ──► J8 pins 4/5

J8 pins 7/8 ──► RS485_2_RX_A/B_EXT ──► SN65HVD3085E (U13)
                                          │
                                          ▼
                                       RXD2_485H ──► U20 ──► U19 6N137 ──► UART2_RX ──► ESP32
```

Mode MCP23S08 U9 GP3/GP2 → `U3_SEL_A/B` → U20 channel select.  
DE/RE: tied + CD4069 assist (**HW-Auto** per firmware comments).

---

## 6. Open hardware questions

1. Confirm stakeholder: target port is page‑9 **J8/UART2** (FW COM3) despite “COM2” wording?  
2. Continuity: does PCB already join TX_A↔RX_A and TX_B↔RX_B?  
3. Continuity: which ESP32 balls carry nets `UART2_TX` / `UART2_RX` on the assembled board?  
4. Obtain exact dated PDF `(20261031-050158)` if it differs from the April 2026 PDF used here.
