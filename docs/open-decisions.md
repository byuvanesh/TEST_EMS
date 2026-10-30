# TEST_EMS — Open Decisions Register

**Updated:** 30 Oct 2026 (Phase 1.5 audit)  
**Rule:** PROPOSED / TBD / VERIFY are **not** confirmed requirements.  
**Hardware / gateway:** not verified.

Classes: **CONFIRMED** · **PROPOSED** · **TBD** · **VERIFY** · **DERIVED** · **FUTURE**

---

## 1. Confirmed (do not reopen without change control)

| ID | Decision | Basis |
|----|----------|-------|
| R001 | Four loads: AC-01 5 TR, AC-02 5 TR, AC-03 8 TR, Compressor-01 | Stakeholder |
| — | Electrical monitoring only; no load control | Brief |
| — | No invented temp/pressure/compressor status sensors in scope | Brief |
| — | Pages: Overview, Energy, Alarms, System + Load Detail drill-down | Brief |
| — | Data quality labels include LIVE / STALE / OFFLINE / DEMO DATA | Design direction |
| — | Light theme tokens / Inter / industrial SaaS UI | Design direction |
| R005 | Meter series offers optional RS-485 Modbus with documented baud/parity options | Datasheet (options CONFIRMED; site settings not) |
| — | EMS is monitoring only, not a protection device | F-03 |

---

## 2. Decisions proposed by Phase 1.5 (still PROPOSED)

| ID | Decision | Notes |
|----|----------|-------|
| C-TEL-01 | Adopt `testems.telemetry.v1` as TEST_EMS-owned ingest schema | Resolves direction on X-01 **if accepted** |
| C-TEL-02 | Mandatory `source_type` REAL \| DEMO on ingest | Isolation |
| C-TEL-03 | Idempotency key `(gateway_id, meter_id, sequence, source_type)` | Duplicates |
| C-TEL-04 | Store NULL for missing measurements; never coerce to 0 | Fixes demo zero-fill anti-pattern |
| C-DB-01 | MySQL tables per database-design-v1 | Stack still PROPOSED |
| C-DB-02 | Separate RAW `telemetry_samples` from DERIVED interval tables | |
| C-API-01 | Fastify REST `/api/v1` as in backend-api-design-v1 | |
| C-API-02 | Default read scope `source_type=REAL` | |
| C-FE-01 | Introduce `services/` adapter seam before wiring API | Audit F-03 |
| C-FE-02 | Move load catalogue out of `mock/` into config or API | Audit F-01 |

Acceptance of C-TEL-01 is the key product decision for Phase 2a.

---

## 3. Blockers / high-priority open items

| ID | Topic | Class | Blocks |
|----|-------|-------|--------|
| X-01 | Independent ingest vs reuse existing contract | Contradiction | Firmware + API ownership |
| R017 | Official Modbus register map | TBD | REAL scaling confidence |
| R018 | Word/byte order and scaling | VERIFY | Bench required |
| R019 | Gateway RS-485 Modbus RTU master capability | VERIFY | Live path |
| R011 / M-02 | CT primaries, class, burden, wiring | TBD | Accuracy, ON thresholds |
| R002 | Compressor type / capacity / nameplate | TBD | Limits, labelling |
| R023 | Who stamps sample time; NTP | TBD | Series integrity |
| R024 | Gateway↔backend protocol auth provisioning | TBD | Secure ingest |
| R030 / M-03 | Demand interval; tariff; billing day | TBD | Peak demand meaning; cost (cost = FUTURE) |
| R037 | LIVE/STALE/OFFLINE age limits | PROPOSED limits TBD | Header + KPI freshness |
| X-05 | Stale loads excluded vs greyed in totals | Contradiction | Overview totals |
| M-04 | Retention, backup RPO/RTO, hosting | TBD | Ops |
| M-05 | Named users, notifications | TBD | Auth / alarm routing |
| R025 | Confirm Fastify + MySQL + REST for TEST_EMS | PROPOSED | Stack lock |
| R027 | Roles Viewer / Operator / Admin + matrix | PROPOSED | System + ack authorization |
| R040 | UTC store / IST display | PROPOSED | Nearly settled culturally; still confirm |
| R029 | Active energy import register/unit/rollover | VERIFY | **Energy page REAL math** |

---

## 4. Energy calculation decisions (explicit)

| Topic | Demo UI today | Production rule needed | Class |
|-------|---------------|------------------------|-------|
| Period energy | Σ hourly kW | Counter delta of active import kWh | DERIVED + VERIFY inputs |
| Gap fill | Zero | No power interpolation; null gaps | CONFIRMED intent from gap analysis |
| Peak demand | Max hourly | Interval / sliding / meter MD | TBD |
| Aggregate PF | Hardcoded Overview KPI | ΣkW/√(ΣkW²+ΣkVAr²); kvar sign | DERIVED + VERIFY |
| Coverage | Synthetic | valid/expected from poll policy | TBD expected interval |
| Partial 4-load site | Filter only | “n of 4” + exclusion rule | TBD (X-05) |
| Rollover/reset | None | Negative delta → new baseline + event | TBD |
| Algorithm versioning | N/A | Store `algorithm_version` on derived rows | PROPOSED |

**Statement:** Mock `energyAnalytics.ts` is **not** a validated physical energy calculation.

---

## 5. Certainty legend for System UI (aligned)

| Label | Meaning |
|-------|---------|
| CONFIRMED | Safe to treat as project fact |
| PROPOSED | Suggested default; needs acceptance |
| TBD | Unknown; must not invent |
| VERIFY | Needs measurement, label, PO, or bench test |
| NOT CONFIGURED | Placeholder in product UI / DB nulls |
| DERIVED | Computed from other inputs once inputs exist |
| FUTURE | Out of current phase |

---

## 6. Phase 2 readiness checklist

### Phase 2a (approved and implemented locally)

- [x] R025 Fastify + TypeScript + MySQL 8 + REST
- [x] C-TEL-01…04 as validation/label rules (no production ingest)
- [x] REAL energy endpoints return UNAVAILABLE until R029 VERIFY
- [x] Active assignment uniqueness via generated `active_load_id`
- [x] Data states NO_DATA / UNKNOWN only; no LIVE/STALE/OFFLINE emission
- [x] Trust boundary L1 LABEL_ONLY only

### Must **not** claim live EMS until:

- [ ] R019 gateway master evidenced  
- [ ] R017/R018 map + scaling path (official or bench-recorded — still no invention in repo)  
- [ ] R011 CT data entered as configured (not guessed)  
- [ ] Stale/partial/demand rules decided (R037 / X-05)  
- [ ] R024 gateway auth before any production ingest (Phase 2b)  
- [ ] Auth for ack/config if exposed beyond demo (R027)  

---

## 7. Audit conclusion (copy)

**Architecture risks:** ingest ownership, unverified gateway/Modbus, demo energy math confusion, null-vs-zero, volume/rollups, auth gaps — see phase-1.5-architecture-audit.md §6.

**Unresolved decisions:** §3 table above.

**Ready for Phase 2?**  
**Yes — for contract-driven backend scaffolding and adapter seams.**  
**No — for asserting hardware integration or validated energy billing/operations metrics.**
