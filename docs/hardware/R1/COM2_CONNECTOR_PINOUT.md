# J8 / CON8 Connector Pinout (UART2 / page‑9 port)

**Schematic:** `TRIKONA_BOARD_CKT_DIAGRAM.pdf` page 9  
**Connector labels:** `J8`, `CON8`  
**Certainty:** **VERIFIED FROM SCHEMATIC** unless noted

> Naming note: Firmware calls this port **COM3**. The R1 brief called the same parts list “COM2”. See `COM2_UART2_RS485_SIGNAL_MAPPING.md`.

---

## 1. Pin table

| Pin | Schematic label (page 9) | Electrical role | RS485 2‑wire notes |
|-----|--------------------------|-----------------|--------------------|
| 1 | `RS232_TX` | RS‑232 transmit (via MAX3232 path) | Not used for Modbus RTU RS‑485 |
| 2 | `RS232_RX` | RS‑232 receive | Not used for Modbus RTU RS‑485 |
| 3 | `GND` | Ground (isolated COM side — confirm bonding policy before tying to meter 0 V) | Reference / shield policy **NOT VERIFIED** on site |
| 4 | `RS485_A / RS422_TX+` | Differential A / TX+ ; net group `RS485_2_TX_A_EXT` | Candidate Modbus **A** |
| 5 | `RS485_B / RS422_TX-` | Differential B / TX− ; net group `RS485_2_TX_B_EXT` | Candidate Modbus **B** |
| 6 | `GND` | Second ground pin | Same isolation caveats as pin 3 |
| 7 | `RS422_RX+` | Differential RX+ ; net group `RS485_2_RX_A_EXT` | Required for RX unless TX/RX pairs are joined |
| 8 | `RS422_RX-` | Differential RX− ; net group `RS485_2_RX_B_EXT` | Required for RX unless TX/RX pairs are joined |

Shield pads `SH1` / `SH2` are present near the connector (**VERIFIED FROM SCHEMATIC**). Chassis/shield earthing practice: **NOT VERIFIED** / site TBD.

---

## 2. RS‑485 vs RS‑422 distinction

| Mode | Pins typically involved | Certainty |
|------|-------------------------|-----------|
| RS‑232 | 1, 2 (+ GND) | **VERIFIED FROM SCHEMATIC** (labels) |
| RS‑485 half‑duplex (intended Modbus) | At minimum 4 & 5; RX on 7 & 8 unless pairs joined | Connector labels **VERIFIED FROM SCHEMATIC**; 2‑wire join **NOT VERIFIED** |
| RS‑422 full‑duplex | 4/5 TX pair + 7/8 RX pair separately | **VERIFIED FROM SCHEMATIC** (separate TX/RX EXT nets + dual SN65) |

**Do not assume** pins 4 and 5 alone form a complete half‑duplex bus without verifying that the receiver pair is electrically present on that bus.

---

## 3. Proposed single‑meter wiring (PROPOSED — not tested)

Until continuity proves an on‑board TX↔RX short:

1. Meter RS‑485 **A** → J8 pin **4**, and also bond to pin **7** if RX is separate (or use a shorting jumper 4–7).  
2. Meter RS‑485 **B** → J8 pin **5**, and also bond to pin **8** (or jumper 5–8).  
3. Meter signal ground / 0 V policy: follow meter manual + isolation rules — **NOT VERIFIED**.  
4. Prefer power‑off wiring; CT work by qualified persons only.

**PHYSICALLY TESTED:** no.

---

## 4. Related connectors (do not confuse)

| Connector | Schematic page | Firmware name | UART |
|-----------|----------------|---------------|------|
| J11 / CON8 (page 5) | COM1 path / `RS485_*` without `_1/_2` suffix | COM1 | UART0 |
| J10 / CON8 (page 8) | `RS485_1_*`, U27 | **COM2** | UART1 |
| **J8 / CON8 (page 9)** | `RS485_2_*`, U20 | **COM3** | UART2 |

All three pages label the shell as `CON8` — identify by **J‑number and page**, not “CON8” alone.
