/**
 * Operational Read APIs Integration Tests — Step 5 (Phase 2b)
 *
 * Test table:
 *  READ-01: Incomplete aggregate handling (total kW null, incomplete: true, missing_loads populated if any load UNVERIFIED/missing)
 *  READ-02: Complete aggregate calculation (when all loads VERIFIED, total kW is sum, incomplete: false, missing_loads: [])
 *  READ-03: Aggregate PF = total kW / total kVA only when both verified for all loads, else null
 *  READ-04: Counter rollover/reset detection in GET /api/energy (negative delta = GAP, never negative energy)
 *  READ-05: UNVERIFIED metric returns null end-to-end (raw_payloads -> pipeline decode -> telemetry_samples -> API response)
 *  READ-06: VERIFIED metric returns decoded numeric value end-to-end
 *  READ-07: REAL/DEMO isolation holds across operational endpoints (DEMO records never appear; source_type=DEMO rejected with 400)
 *  READ-08: A load with zero mappings returns NO_DATA cleanly without crashing
 *  READ-09: GET /api/loads/:id/history returns historical telemetry samples
 *  READ-10: GET /api/system/gateway returns gateway status and meter state labeled "gateway-level only" with required note
 *  READ-11: GET /api/bridge/status returns bridge connection status, mode, and metrics
 *  READ-12: No demand calculation — meter-reported demand only when VERIFIED
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { RowDataPacket } from 'mysql2/promise'
import { randomUUID } from 'node:crypto'
import { buildApp } from '../../src/app.js'
import { runMigrations } from '../../src/database/migrate.js'
import { closePools, getMigratePool } from '../../src/database/pool.js'
import { seedCatalogue } from '../../seeds/catalogue.js'
import { processRawPayload } from '../../src/services/telemetryPipeline.js'
import { BridgeService, setActiveBridge } from '../../src/services/bridgeService.js'
import { getEnv } from '../../src/config/env.js'

let app: FastifyInstance
let siteId: string
let gatewayId: string
const GATEWAY_MAC = 'AA:BB:CC:DD:EE:77'

interface LoadMeterInfo {
  load_id: string
  code: string
  name: string
  meter_id: string
}

let loadMeters: LoadMeterInfo[] = []

async function cleanTelemetry(): Promise<void> {
  const pool = getMigratePool()
  await pool.query('DELETE FROM telemetry_samples')
  await pool.query('DELETE FROM raw_payloads')
  await pool.query('DELETE FROM metric_mappings')
}

beforeAll(async () => {
  await runMigrations()
  const pool = getMigratePool()

  // Seed standard catalogue (4 loads, meters, gateway, links)
  const seeded = await seedCatalogue({ emptyMetersAndMappings: false })
  siteId = seeded.siteId

  // Assign configured GATEWAY_MAC to the REAL gateway
  const [gwRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM gateways WHERE site_id = ? AND source_type = "REAL" LIMIT 1',
    [siteId],
  )
  gatewayId = String(gwRows[0]?.id)
  await pool.query('UPDATE gateways SET mac = ? WHERE id = ?', [GATEWAY_MAC, gatewayId])

  // Ensure all meters for siteId are linked to this gateway in gateway_meter_links
  const [siteMeters] = await pool.query<RowDataPacket[]>(
    `SELECT m.id AS meter_id, lma.load_id, l.code, l.name
     FROM meters m
     INNER JOIN load_meter_assignments lma ON lma.meter_id = m.id AND lma.valid_to IS NULL
     INNER JOIN loads l ON l.id = lma.load_id
     WHERE m.site_id = ? AND m.source_type = 'REAL'
     ORDER BY l.sort_order ASC`,
    [siteId],
  )

  for (const row of siteMeters) {
    await pool.query(
      `INSERT INTO gateway_meter_links (id, gateway_id, meter_id, created_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE gateway_id = VALUES(gateway_id)`,
      [randomUUID(), gatewayId, row.meter_id],
    )
  }

  loadMeters = siteMeters.map((r) => ({
    load_id: String(r.load_id),
    code: String(r.code),
    name: String(r.name),
    meter_id: String(r.meter_id),
  }))

  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  setActiveBridge(null)
  if (app) await app.close()
  await closePools()
})

describe('Step 5 — Operational Read APIs & Telemetry Pipeline', () => {

  it('READ-01: Incomplete aggregate handling (total kW null, incomplete: true, missing_loads populated when any load is UNVERIFIED or missing)', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()

    // Setup 4 loads: AC-01 has verified kW (10.5), AC-02 has UNVERIFIED kW (producing NULL),
    // AC-03 and Compressor-01 have no telemetry.
    const ac01 = loadMeters.find((l) => l.code === 'AC-01')!
    const ac02 = loadMeters.find((l) => l.code === 'AC-02')!

    // Insert active telemetry sample for AC-01 (10.5 kW)
    await pool.query(
      `INSERT INTO telemetry_samples (
         site_id, gateway_id, meter_id, load_id, source_type, schema_version,
         sample_time, received_at, sequence, quality, active_power_kw
       ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 1001, 'OK', 10.5)`,
      [siteId, gatewayId, ac01.meter_id, ac01.load_id],
    )

    // Insert sample for AC-02 with active_power_kw = NULL (simulating an UNVERIFIED mapping)
    await pool.query(
      `INSERT INTO telemetry_samples (
         site_id, gateway_id, meter_id, load_id, source_type, schema_version,
         sample_time, received_at, sequence, quality, active_power_kw
       ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 1002, 'UNKNOWN', NULL)`,
      [siteId, gatewayId, ac02.meter_id, ac02.load_id],
    )

    const res = await app.inject({ method: 'GET', url: `/api/v1/sites/${siteId}/overview` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    // When ANY load has null or missing kW:
    // total_active_power_kw MUST be null, incomplete MUST be true, missing_loads MUST list the unverified/missing loads
    expect(body.total_active_power_kw).toBeNull()
    expect(body.incomplete).toBe(true)
    expect(Array.isArray(body.missing_loads)).toBe(true)
    expect(body.missing_loads).toContain('AC-02')
    expect(body.missing_loads).toContain('AC-03')
    expect(body.missing_loads).toContain('Compressor-01')
    expect(body.missing_loads).not.toContain('AC-01')

    // Aggregate PF must be null
    expect(body.aggregate_pf).toBeNull()
    expect(body.analytics.aggregate_pf.availability).toBe('UNAVAILABLE')
  })

  it('READ-02: Complete aggregate calculation (when all loads are VERIFIED, total kW is sum, incomplete: false, missing_loads: [])', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()

    const powers = [10.5, 12.0, 15.25, 20.0]
    let expectedSum = 0

    // Provide verified active power for ALL 4 loads
    for (let i = 0; i < loadMeters.length; i++) {
      const lm = loadMeters[i]!
      const kw = powers[i]!
      expectedSum += kw

      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, active_power_kw
         ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), ?, 'OK', ?)`,
        [siteId, gatewayId, lm.meter_id, lm.load_id, 2000 + i, kw],
      )
    }

    const res = await app.inject({ method: 'GET', url: '/api/overview' })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.incomplete).toBe(false)
    expect(body.missing_loads).toEqual([])
    expect(body.total_active_power_kw).toBeCloseTo(expectedSum, 3)
  })

  it('READ-03: Aggregate PF = total kW / total kVA only when both verified for all loads, else null', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()

    // 1. First scenario: all loads have kW, but one load is missing kVA
    for (let i = 0; i < loadMeters.length; i++) {
      const lm = loadMeters[i]!
      const kva = i === 0 ? null : 15.0 // load 0 has null kVA
      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, active_power_kw, apparent_power_kva
         ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), ?, 'OK', 10.0, ?)`,
        [siteId, gatewayId, lm.meter_id, lm.load_id, 3000 + i, kva],
      )
    }

    let res = await app.inject({ method: 'GET', url: '/api/overview' })
    expect(res.json().aggregate_pf).toBeNull()

    // 2. Second scenario: all loads have verified kW (10 kW each = 40 kW total) and kVA (12.5 kVA each = 50 kVA total)
    // Expected Aggregate PF = 40 / 50 = 0.8
    await cleanTelemetry()
    for (let i = 0; i < loadMeters.length; i++) {
      const lm = loadMeters[i]!
      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, active_power_kw, apparent_power_kva
         ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), ?, 'OK', 10.0, 12.5)`,
        [siteId, gatewayId, lm.meter_id, lm.load_id, 3100 + i],
      )
    }

    res = await app.inject({ method: 'GET', url: '/api/overview' })
    const body = res.json()
    expect(body.total_active_power_kw).toBe(40)
    expect(body.aggregate_pf).toBeCloseTo(0.8, 4)
    expect(body.analytics.aggregate_pf.availability).toBe('AVAILABLE')
    expect(body.analytics.aggregate_pf.value).toBeCloseTo(0.8, 4)
  })

  it('READ-04: Counter rollover/reset detection in GET /api/energy (negative delta = GAP, never negative energy)', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()
    const target = loadMeters[0]!

    // Sequence of active_import_kwh readings over time:
    // t1: 1000 kWh
    // t2: 1050 kWh (+50 kWh consumed -> status: 'OK')
    // t3: 50 kWh   (Rollover / meter reset! delta is -1000 -> status: 'GAP', energy_kwh: null)
    // t4: 80 kWh   (+30 kWh consumed -> status: 'OK')
    const samples = [
      { t: '2026-10-31 10:00:00.000', kwh: 1000.0 },
      { t: '2026-10-31 10:15:00.000', kwh: 1050.0 },
      { t: '2026-10-31 10:30:00.000', kwh: 50.0 },
      { t: '2026-10-31 10:45:00.000', kwh: 80.0 },
    ]

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!
      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, active_import_kwh
         ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1', ?, UTC_TIMESTAMP(3), ?, 'OK', ?)`,
        [siteId, gatewayId, target.meter_id, target.load_id, s.t, 4000 + i, s.kwh],
      )
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/energy?loadId=${target.load_id}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.method).toBe('counter-delta')
    expect(body.has_gaps).toBe(true)

    // Interval 0: 1000 -> 1050 = 50 kWh (OK)
    expect(body.intervals[0].status).toBe('OK')
    expect(body.intervals[0].energy_kwh).toBe(50.0)

    // Interval 1: 1050 -> 50 = Rollover! Must NOT be -1000, must be GAP with null energy
    expect(body.intervals[1].status).toBe('GAP')
    expect(body.intervals[1].energy_kwh).toBeNull()
    expect(body.intervals[1].reason).toBe('COUNTER_ROLLOVER_OR_RESET')

    // Interval 2: 50 -> 80 = 30 kWh (OK)
    expect(body.intervals[2].status).toBe('OK')
    expect(body.intervals[2].energy_kwh).toBe(30.0)

    // Total energy = 50 + 30 = 80 kWh (never subtracted negative numbers)
    expect(body.total_energy_kwh).toBe(80.0)
  })

  it('READ-05: UNVERIFIED metric returns null end-to-end (raw_payloads -> pipeline decode -> telemetry_samples -> API response)', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()
    const [targetRows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id AS meter_id, lma.load_id
       FROM meters m
       INNER JOIN gateway_meter_links gml ON gml.meter_id = m.id
       INNER JOIN load_meter_assignments lma ON lma.meter_id = m.id AND lma.valid_to IS NULL
       WHERE gml.gateway_id = ? AND m.source_type = 'REAL'
       LIMIT 1`,
      [gatewayId],
    )
    const target = {
      meter_id: String(targetRows[0]!.meter_id),
      load_id: String(targetRows[0]!.load_id),
    }

    // Create an UNVERIFIED metric mapping for power_kw
    const mappingId = randomUUID()
    await pool.query(
      `INSERT INTO metric_mappings (
         id, meter_id, metric, source_keys, decode, word_order, byte_order,
         scale, offset, unit, verification_status, version, created_at, updated_at
       ) VALUES (?, ?, 'active_power_kw', '["kw_reg"]', 'float32', 'BE', 'BE',
                 1.0, 0.0, 'kW', 'UNVERIFIED', 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [mappingId, target.meter_id],
    )

    // Process a raw payload through the production pipeline
    // float32 BE/BE for 230.5 is 0x43668000 -> registers: 17254, 32768
    const rawPayload = { kw_reg: [17254, 32768] }
    const ts = 1_700_000_100_000

    const result = await processRawPayload(pool, GATEWAY_MAC, ts, rawPayload, 1)
    expect(result.samples_created).toBeGreaterThanOrEqual(1)

    // Verify telemetry_samples has a row written with NULL active_power_kw (never skipped, never 0)
    const [sampleRows] = await pool.query<RowDataPacket[]>(
      'SELECT active_power_kw, quality FROM telemetry_samples WHERE load_id = ? AND sequence = ?',
      [target.load_id, ts],
    )
    expect(sampleRows.length).toBe(1)
    expect(sampleRows[0]?.active_power_kw).toBeNull()

    // Verify GET /api/loads/:id returns measurements.active_power_kw = null
    const res = await app.inject({ method: 'GET', url: `/api/loads/${target.load_id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().measurements.active_power_kw).toBeNull()
  })

  it('READ-06: VERIFIED metric returns decoded numeric value end-to-end', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()
    const [targetRows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id AS meter_id, lma.load_id
       FROM meters m
       INNER JOIN gateway_meter_links gml ON gml.meter_id = m.id
       INNER JOIN load_meter_assignments lma ON lma.meter_id = m.id AND lma.valid_to IS NULL
       WHERE gml.gateway_id = ? AND m.source_type = 'REAL'
       LIMIT 1`,
      [gatewayId],
    )
    const target = {
      meter_id: String(targetRows[0]!.meter_id),
      load_id: String(targetRows[0]!.load_id),
    }

    // Create a VERIFIED metric mapping for power_kw
    const mappingId = randomUUID()
    await pool.query(
      `INSERT INTO metric_mappings (
         id, meter_id, metric, source_keys, decode, word_order, byte_order,
         scale, offset, unit, verification_status, verified_by, verified_at, evidence_note,
         version, created_at, updated_at
       ) VALUES (?, ?, 'active_power_kw', '["kw_reg"]', 'float32', 'BE', 'BE',
                 1.0, 0.0, 'kW', 'VERIFIED', 'eng_user', UTC_TIMESTAMP(3), 'Verified on site meter LCD',
                 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [mappingId, target.meter_id],
    )

    const rawPayload = { kw_reg: [17254, 32768] } // 230.5
    const ts = 1_700_000_200_000

    await processRawPayload(pool, GATEWAY_MAC, ts, rawPayload, 1)

    // Verify telemetry_samples contains decoded float 230.5
    const [sampleRows] = await pool.query<RowDataPacket[]>(
      'SELECT active_power_kw, quality FROM telemetry_samples WHERE load_id = ? AND sequence = ?',
      [target.load_id, ts],
    )
    expect(sampleRows.length).toBe(1)
    expect(Number(sampleRows[0]?.active_power_kw)).toBeCloseTo(230.5, 1)

    // Verify GET /api/loads/:id returns the decoded value
    const res = await app.inject({ method: 'GET', url: `/api/loads/${target.load_id}` })
    expect(res.statusCode).toBe(200)
    expect(Number(res.json().measurements.active_power_kw)).toBeCloseTo(230.5, 1)
  })

  it('READ-07: REAL/DEMO isolation holds across operational endpoints', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()
    const target = loadMeters[0]!

    // Create a DEMO meter and insert a DEMO sample with high power (9999 kW)
    const demoMeterId = randomUUID()
    await pool.query(
      `INSERT INTO meters (id, site_id, source_type, label, status, created_at)
       VALUES (?, ?, 'DEMO', 'Demo Isolation Meter', 'installed', UTC_TIMESTAMP(3))`,
      [demoMeterId, siteId],
    )
    await pool.query(
      `INSERT INTO telemetry_samples (
         site_id, gateway_id, meter_id, load_id, source_type, schema_version,
         sample_time, received_at, sequence, quality, active_power_kw, active_import_kwh
       ) VALUES (?, ?, ?, ?, 'DEMO', 'testems.telemetry.v1', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 888001, 'OK', 9999.0, 8888.0)`,
      [siteId, gatewayId, demoMeterId, target.load_id],
    )

    // 1. Overview must not reflect the DEMO sample
    const overviewRes = await app.inject({ method: 'GET', url: '/api/overview' })
    expect(overviewRes.json().total_active_power_kw).toBeNull()

    // 2. Load detail must not show DEMO sample
    const loadRes = await app.inject({ method: 'GET', url: `/api/loads/${target.load_id}` })
    expect(loadRes.json().measurements.active_power_kw).toBeNull()

    // 3. Load history must be empty
    const histRes = await app.inject({ method: 'GET', url: `/api/loads/${target.load_id}/history` })
    expect(histRes.json().samples.length).toBe(0)

    // 4. Energy must be empty
    const energyRes = await app.inject({ method: 'GET', url: `/api/energy?loadId=${target.load_id}` })
    expect(energyRes.json().total_energy_kwh).toBe(0)

    // 5. Explicitly requesting source_type=DEMO MUST be rejected with 400 DEMO_NOT_ALLOWED
    const rejected = await app.inject({ method: 'GET', url: '/api/loads?source_type=DEMO' })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json().error.code).toBe('DEMO_NOT_ALLOWED')
  })

  it('READ-08: A load with zero mappings returns NO_DATA cleanly', async () => {
    await cleanTelemetry()
    const target = loadMeters[0]!

    // No mappings and no samples exist for target load
    const res = await app.inject({ method: 'GET', url: `/api/loads/${target.load_id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.data_state).toBe('NO_DATA')
    expect(body.as_of).toBeNull()
    for (const val of Object.values(body.measurements)) {
      expect(val).toBeNull()
    }
  })

  it('READ-09: GET /api/loads/:id/history returns historical telemetry samples', async () => {
    await cleanTelemetry()
    const pool = getMigratePool()
    const target = loadMeters[0]!

    // Insert 3 historical samples
    for (let i = 1; i <= 3; i++) {
      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, active_power_kw, voltage_v
         ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1',
           DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? MINUTE), UTC_TIMESTAMP(3), ?, 'OK', ?, 230.0)`,
        [siteId, gatewayId, target.meter_id, target.load_id, i, 5000 + i, 10.0 * i],
      )
    }

    const res = await app.inject({ method: 'GET', url: `/api/loads/${target.load_id}/history?limit=10` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.source_type).toBe('REAL')
    expect(body.count).toBe(3)
    expect(body.samples.length).toBe(3)
    // Most recent sample first
    expect(body.samples[0].active_power_kw).toBe(30.0)
    expect(body.samples[1].active_power_kw).toBe(20.0)
    expect(body.samples[2].active_power_kw).toBe(10.0)
  })

  it('READ-10: GET /api/system/gateway returns gateway status and meter state labeled "gateway-level only" with required note', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/system/gateway' })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.gateway).toBeDefined()
    expect(body.gateway.mac).toBe(GATEWAY_MAC)
    expect(Array.isArray(body.meters)).toBe(true)
    expect(body.meters.length).toBeGreaterThan(0)

    for (const m of body.meters) {
      expect(m.state_assurance).toBe('gateway-level only')
      expect(m.note).toBe('Meter state labeled "gateway-level only" until a bench test proves per-meter failure behavior.')
    }
  })

  it('READ-11: GET /api/bridge/status returns bridge connection status, mode, and metrics', async () => {
    // 1. Without active bridge: returns disabled/disconnected
    setActiveBridge(null)
    let res = await app.inject({ method: 'GET', url: '/api/bridge/status' })
    expect(res.statusCode).toBe(200)
    let body = res.json()
    expect(body.status).toBe('disabled')
    expect(body.mode).toBe('none')
    expect(body.metrics).toBeDefined()

    // 2. With active bridge instance
    const env = getEnv()
    const pool = getMigratePool()
    const bridge = new BridgeService(env, pool, {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    })
    setActiveBridge(bridge)

    res = await app.inject({ method: 'GET', url: '/api/bridge/status' })
    expect(res.statusCode).toBe(200)
    body = res.json()
    expect(body.metrics).toBeDefined()
    expect(typeof body.metrics.archiveInserts).toBe('number')
  })

  it('READ-12: No demand calculation — meter-reported demand only when VERIFIED', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/energy' })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.demand).toBeDefined()
    expect(body.demand.availability).toBe('UNAVAILABLE')
    expect(body.demand.reason_codes).toContain('DEMAND_INTERVAL_TBD')
    expect(body.demand.value).toBeNull()
  })
})
