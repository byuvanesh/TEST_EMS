# Secure Elite 103‑2 — Register & Serial Verification

**Project:** TEST_EMS  
**Date:** 2026-10-31  
**Rule:** Never invent register addresses or scaling.

---

## 1. Document search result

| Location searched | Official Elite 103‑2 Modbus map / datasheet PDF found? |
|-------------------|--------------------------------------------------------|
| `B:\TEST_EMS` | **No** |
| `B:\ELLCRAFTS_FOLDER` | **No** meter docs |
| `C:\Users\YUVA\Downloads` | **No** primary Secure Meters PDF / ConfigView export / TrackSo Elite map |
| `B:\test_code`, `B:\copy` | **No** |

Secondary PROJECT/TEST_EMS Word docs **cite** Secure Elite 100/300 datasheet options and propose Elite 103‑2, but the primary PDF is **absent**.

**Overall register-map status: NOT VERIFIED / BLOCKED**

---

## 2. Checklist

| Item | Status | Notes |
|------|--------|-------|
| Exact meter model on nameplate | **NOT VERIFIED** | Project intent = Elite 103‑2 (**VERIFIED FROM PROJECT DOCS** as VERIFY/PROPOSED) |
| CAT / ordering code | **NOT VERIFIED** | Secondary decode in gap docs only; PO/nameplate not seen |
| Modbus RTU protocol revision | **NOT VERIFIED** | |
| Slave ID | **NOT VERIFIED** | Do not assign until physical meter config confirmed |
| Baud rate | Options cited 1200–19200 (default 9600) in project docs | **VERIFIED FROM PROJECT DOCS** as citation; **NOT VERIFIED FROM METER DOCUMENTATION** (PDF missing). Site setting **NOT VERIFIED** |
| Parity | N/O/E options cited | Same as above |
| Stop bits | 1 or 2 cited | Same as above |
| Data bits | **NOT VERIFIED** | |
| Measurement register addresses | **NOT VERIFIED / BLOCKED** | |
| Data types | **NOT VERIFIED** | |
| Scaling factors | **NOT VERIFIED / BLOCKED** | |
| Byte order / word order | **NOT VERIFIED / BLOCKED** | |
| Energy counter format / rollover | **NOT VERIFIED / BLOCKED** (open R029) | |
| TrackSo settings | **No TrackSo configs found** | Must **not** be assumed valid for Trikona |

---

## 3. Documents required before REAL Modbus decode

1. Secure Meters **Elite 100/300** (or delivered variant) **datasheet** on file.  
2. **Official Elite 103‑2 Modbus register map** (Secure Meters / ConfigView) covering address, function code, count, type, word/byte order, scaling, energy format.  
3. PO / nameplate / serial confirming Modbus‑capable **103‑2**.  
4. Site commissioning record: slave ID, baud/parity/stop, CT ratios, 3P3W/3P4W.  
5. Optional bench log: Modbus value vs meter display.

Until then, firmware/API must **not** hard‑code Elite register addresses as confirmed facts.

---

## 4. Relationship to TEST_EMS backend

Telemetry contract `testems.telemetry.v1` accepts **engineering units only** (`electrical.*`, `energy.*`). It intentionally excludes Modbus addresses. Mapping from registers → engineering units is a **gateway/firmware** concern and remains **BLOCKED** on this document.
