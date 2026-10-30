# Requirements and Assumptions — TEST_EMS Phase 0

**Sources (priority):**

1. `TEST_EMS_Requirement_Gap_Analysis.docx` — primary gaps and classification
2. `TEST_EMS – Design Direction (Light Theme).docx` — UI direction
3. `PROJECT_EMS_Revised_Specification_v2.docx` — supporting only
4. `PROJECT_EMS_Review_and_Benchmark.docx` — supporting only

**Rule:** PROPOSED, TBD, and VERIFY items are **not** treated as confirmed requirements.

## Confirmed for Phase 0 UI

| ID | Item | Basis |
|----|------|-------|
| R001 | Four loads: AC-01 5 TR, AC-02 5 TR, AC-03 8 TR, Compressor | Stakeholder statement |
| — | Electrical monitoring only | Project brief |
| — | No load control | Project brief / FUTURE (R046) |
| — | No invented temp/pressure/compressor status sensors | Project brief |
| — | Pages: Overview, Energy, Alarms, System + Load Detail drill-down | Brief + design doc |
| — | Data states LIVE / STALE / OFFLINE / DEMO DATA | Design direction |
| — | Light theme palette and Inter typography | Design direction |

## Explicitly TBD / VERIFY (not implemented as fact)

| Topic | Class | Phase 0 handling |
|-------|-------|------------------|
| Compressor type & capacity | TBD | Labelled “Capacity TBD” |
| Elite 103-2 variant / official register map | VERIFY / TBD | Not invented |
| CT primaries, class, burden | TBD | Omitted |
| Slave IDs, baud, poll interval | PROPOSED | Not coded as config truth |
| Gateway RS-485 master capability | VERIFY | Gateway strip = DEMO / unknown |
| Alarm limits, demand interval, tariff | TBD | Demo alarms labelled as such |
| Roles Viewer / Operator / Admin | PROPOSED | No auth yet |
| UTC store / IST display | PROPOSED | Demo timestamps shown in IST format |
| Stack Fastify + MySQL + REST | PROPOSED | Documented; backend not built |
| Ingest contract reuse vs independent (X-01) | Contradiction | Flagged open |

## Assumptions used only for UI scaffolding

These are **UI assumptions**, not product requirements:

1. Site display name: “TEST_EMS Demo Site” until real site naming (M-06) is provided.
2. Demo KPI formulas are illustrative; aggregate PF and peak-demand interval rules remain open.
3. Search and notification panel controls are non-functional placeholders.
4. System page lists confirmed load names only; device CRUD is deferred.
5. Energy page intentionally empty of fake historical series beyond Overview’s labelled demo chart.

## Out of scope (Phase 0)

- Backend API and MySQL schema
- Real Modbus / gateway integration
- Authentication, MFA, audit log storage
- PDF / scheduled reports, cost / tariff
- Temperature, pressure, trip sensors
- Load control
- Multi-site

## Safety

EMS is **monitoring only**, not a protection device (gap analysis F-03).
