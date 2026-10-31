# R1 — Single Meter Test Procedure (COM port on J8 / UART2)

**Scope:** One Secure Elite 103‑2 (or confirmed equivalent) on the page‑9 Trikona serial port (**J8**, firmware name **COM3**, task brief parts list).  
**Prerequisite docs:** `COM2_UART2_RS485_SIGNAL_MAPPING.md`, `COM2_CONNECTOR_PINOUT.md`, `SECURE_ELITE_103_2_REGISTER_VERIFICATION.md`  
**Status:** Procedure only — **not executed** in this audit (`PHYSICALLY TESTED`: none).

**Safety**

- EMS is monitoring only — not a protection device.  
- **Never open an energised CT secondary.** CT and mains wiring by **qualified personnel** only.  
- Prefer meter powered for display checks with CT secondaries already correctly closed by an electrician.  
- Power down gateway/meter communications side before changing RS‑485 jumpers when practical.

---

## 0. Gate — do not start until cleared

| Gate | Required state |
|------|----------------|
| Port naming | Stakeholder confirms J8/UART2 is the intended port (FW COM3 vs brief “COM2”) |
| Register map | Official map available **or** test limited to raw request/response + display compare without claiming scaled engineering truth |
| Firmware | Build that can master Modbus RTU on UART2 / FW COM3 identified |
| Two‑wire join | Continuity plan for pins 4/5 ↔ 7/8 agreed |

If any gate fails → mark attempt **BLOCKED**, do not record PASS.

---

## 1. Hardware inspection (power off where possible)

1. Identify connector **J8** (page 9), not J10/J11.  
2. Photograph connector and cable.  
3. Confirm SN65 / opto region visually if board access allows — no rework.  
4. Record gateway firmware version / binary identity.  
5. Record meter nameplate (model, serial, any Modbus/CAT markings).

**Label results:** `PHYSICALLY TESTED` only after this inspection is done on the real unit.

---

## 2. Power‑off wiring checks

1. Continuity: meter A/B cable integrity.  
2. Continuity: J8 pin4 ↔ pin7 and pin5 ↔ pin8 **if** using external 2‑wire shorts.  
3. Confirm no short A↔B.  
4. Confirm cable shield / GND policy matches isolation plan (see pinout doc).  
5. Termination: note whether meter and/or gateway on‑board 120 Ω is appropriate for a short stub (gateway already has 120 Ω on each pair — **VERIFIED FROM SCHEMATIC**; bus loading **NOT VERIFIED** until measured).

---

## 3. RS‑485 A/B polarity

1. Wire meter A → gateway A (pin 4 + joined RX A as required).  
2. Wire meter B → gateway B (pin 5 + joined RX B as required).  
3. If no response, swap A/B **once** as a controlled experiment and record.

---

## 4. UART / Modbus configuration (gateway)

Use values **from the meter’s confirmed config**, not assumptions.

| Parameter | Until meter docs exist |
|-----------|------------------------|
| Port | FW **COM3** / UART2 / J8 |
| Mode | RS‑485 |
| Baud / parity / stop | **NOT VERIFIED** — read from meter / commissioning sheet |
| Slave ID | **NOT VERIFIED** — read from meter |
| Master timeout | Start conservative (e.g. 500–1000 ms) — tune after first responses |
| Inter‑frame delay | Respect Modbus RTU silent interval for chosen baud |

---

## 5. Request / response capture

1. Capture raw TX and RX bytes (logic analyser, USB‑RS485 sniffer on the bus, or gateway debug hex log).  
2. Verify slave address echo and function code.  
3. Validate **CRC16** (Modbus RTU) on responses — library success ≠ skip CRC check in the lab notebook.  
4. Record timeout and exception codes separately (`0xE2` timeout / `0xE1` CRC noted in controller UI text — **VERIFIED FROM FIRMWARE** as library codes, not as a PASS).

---

## 6. Display comparison

1. For each decoded quantity that the **official map** defines, compare to meter display.  
2. Without an official map: only record raw register payloads as **NOT VERIFIED** engineering values.  
3. Never mark REAL telemetry PASS from display‑similar guesses.

---

## 7. Negative tests

1. Disconnect A or B → expect timeout / quality OFFLINE — no crash.  
2. Wrong slave ID → timeout or exception — no false data.  
3. Power‑cycle gateway → session recovers and poll resumes.  
4. Reconnect cable → communication recovers within documented retry policy.

---

## 8. Pass criteria (single meter)

| ID | Criterion | Result options |
|----|-----------|----------------|
| S1 | Correct port (J8) used | PASS / FAIL / BLOCKED |
| S2 | Stable RTU request/response with valid CRC | PASS / FAIL / BLOCKED |
| S3 | Slave ID matches meter setting | PASS / FAIL / BLOCKED |
| S4 | At least one quantity matches display using **official** map | PASS / FAIL / **BLOCKED** if map missing |
| S5 | Disconnect/timeout behaviour safe | PASS / FAIL |
| S6 | No CT secondary opened during test | PASS / FAIL |

**Do not** start four‑meter polling until S2 is PASS and S4 is PASS or explicitly waived as “raw‑only lab”.
