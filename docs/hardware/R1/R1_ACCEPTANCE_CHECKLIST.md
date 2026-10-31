# R1 Acceptance Checklist

**Rule:** Untested communication is never PASS. Missing evidence → NOT VERIFIED or BLOCKED.

| ID | Item | Evidence type | Result |
|----|------|---------------|--------|
| A01 | Schematic PDF identified and page 9 inspected | VERIFIED FROM SCHEMATIC | DONE (audit) |
| A02 | Dated PDF `(20261031-050158)` matched | — | **BLOCKED** — file not found; used `TRIKONA_BOARD_CKT_DIAGRAM.pdf` |
| A03 | COM port naming reconciled (brief COM2 vs FW COM3 on J8) | — | **BLOCKED** — stakeholder decision required |
| A04 | UART2 net ↔ ESP32 GPIO balls continuity | PHYSICALLY TESTED | **NOT VERIFIED** |
| A05 | J8 pinout documented | VERIFIED FROM SCHEMATIC | DONE (audit) |
| A06 | Dual TX/RX differential paths documented | VERIFIED FROM SCHEMATIC | DONE (audit) |
| A07 | Two‑wire join method proven | PHYSICALLY TESTED | **NOT VERIFIED** |
| A08 | DE/RE behaviour understood | VERIFIED FROM SCHEMATIC + FIRMWARE | DONE (audit) — HW-Auto / mux mode |
| A09 | Mode MCP / 74HC4052 RS485 select | VERIFIED FROM FIRMWARE + SCHEMATIC | DONE (audit) |
| A10 | Modbus RTU master exists in available firmware | VERIFIED FROM FIRMWARE | PARTIAL — see compatibility report |
| A11 | Official Elite 103‑2 register map on file | VERIFIED FROM METER DOCUMENTATION | **BLOCKED** |
| A12 | Meter serial settings confirmed on device | PHYSICALLY TESTED | **NOT VERIFIED** |
| A13 | Single‑meter CRC‑valid RTU exchange | PHYSICALLY TESTED | **NOT VERIFIED** |
| A14 | Display comparison with official scaling | PHYSICALLY TESTED + METER DOC | **BLOCKED** |
| A15 | Disconnect / timeout safe behaviour | PHYSICALLY TESTED | **NOT VERIFIED** |
| A16 | Four‑meter sequential poll | PHYSICALLY TESTED | **NOT VERIFIED** — gated on A13 |
| A17 | REAL vs DEMO separation preserved in backend plans | VERIFIED FROM PROJECT DOCS | DONE (audit) |
| A18 | No backend/firmware/frontend modified during this audit | Process | DONE |

**R1 lab acceptance (minimum to proceed to implementation planning):** A03, A07, A10 (usable build), A11, A13, A14.
