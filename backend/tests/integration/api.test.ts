import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RowDataPacket } from 'mysql2/promise'
import { buildApp } from '../../src/app.js'
import { runMigrations } from '../../src/database/migrate.js'
import { closePools, getMigratePool } from '../../src/database/pool.js'
import { seedCatalogue } from '../../seeds/catalogue.js'
import { newId } from '../../src/utils/ids.js'

type TestApp = Awaited<ReturnType<typeof buildApp>>

let app: TestApp
let siteId = ''
let loadId = ''

async function truncateAll(): Promise<void> {
  const pool = getMigratePool()
  await pool.query('SET FOREIGN_KEY_CHECKS=0')
  for (const table of [
    'telemetry_samples',
    'gateway_meter_links',
    'load_meter_assignments',
    'meters',
    'gateways',
    'loads',
    'sites',
  ]) {
    await pool.query(`TRUNCATE TABLE ${table}`)
  }
  await pool.query('SET FOREIGN_KEY_CHECKS=1')
}

describe('API integration (MySQL 8)', () => {
  beforeAll(async () => {
    await runMigrations()
    await truncateAll()
    const seeded = await seedCatalogue({ emptyMetersAndMappings: false })
    siteId = seeded.siteId
    const [loads] = await getMigratePool().query<RowDataPacket[]>(
      'SELECT id FROM loads WHERE site_id = ? ORDER BY sort_order LIMIT 1',
      [siteId],
    )
    loadId = String(loads[0]?.id)
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    await closePools()
  })

  it('AT-13: health live works', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })

  it('AT-14: health ready checks MySQL', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(res.statusCode).toBe(200)
    expect(res.json().database).toBe('up')
  })

  it('AT-15: empty REAL overview returns NO_DATA', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${siteId}/overview`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.source_type).toBe('REAL')
    expect(body.origin_assurance).toBe('LABEL_ONLY')
    expect(body.data_state).toBe('NO_DATA')
    expect(body.loads_reporting).toBe(0)
    expect(body.as_of).toBeNull()
    for (const load of body.loads) {
      expect(load.data_state).toBe('NO_DATA')
      expect(load.as_of).toBeNull()
      expect(load.measurements.active_power_kw).toBeNull()
    }
    expect(body.data_state).not.toBe('LIVE')
    expect(body.data_state).not.toBe('STALE')
    expect(body.data_state).not.toBe('OFFLINE')
  })

  it('AT-16: empty REAL load preserves NULL', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/loads/${loadId}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data_state).toBe('NO_DATA')
    expect(body.measurements.active_power_kw).toBeNull()
    expect(body.measurements.current_a).toBeNull()
    expect(Object.values(body.measurements).every((v) => v === null)).toBe(true)
  })

  it('AT-17: DEMO records never appear in REAL APIs', async () => {
    const pool = getMigratePool()
    const [meta] = await pool.query<RowDataPacket[]>(
      `SELECT g.id AS gateway_id, a.meter_id, a.load_id
       FROM load_meter_assignments a
       INNER JOIN gateways g ON g.site_id = ?
       WHERE a.load_id = ? AND a.valid_to IS NULL
       LIMIT 1`,
      [siteId, loadId],
    )
    const demoMeterId = newId()
    await pool.query(
      `INSERT INTO meters (id, site_id, source_type, label, status, created_at)
       VALUES (?, ?, 'DEMO', 'Demo Meter for AT-17', 'installed', UTC_TIMESTAMP(3))`,
      [demoMeterId, siteId],
    )
    await pool.query(
      `INSERT INTO telemetry_samples (
         site_id, gateway_id, meter_id, load_id, source_type, schema_version,
         sample_time, received_at, sequence, quality, active_power_kw
       ) VALUES (?, ?, ?, ?, 'DEMO', 'testems.telemetry.v1',
         UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 999001, 'UNKNOWN', 12.3456)`,
      [siteId, String(meta[0]?.gateway_id), demoMeterId, loadId],
    )

    const overview = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${siteId}/overview`,
    })
    const body = overview.json()
    expect(body.data_state).toBe('NO_DATA')
    expect(body.loads_reporting).toBe(0)
    const load = body.loads.find((l: { load_id: string }) => l.load_id === loadId)
    expect(load.measurements.active_power_kw).toBeNull()

    const rejected = await app.inject({
      method: 'GET',
      url: `/api/v1/overview?source_type=DEMO`,
    })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json().error.code).toBe('DEMO_NOT_ALLOWED')
  })

  it('AT-18: unknown site/load returns 404', async () => {
    const siteRes = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${newId()}`,
    })
    expect(siteRes.statusCode).toBe(404)
    const loadRes = await app.inject({
      method: 'GET',
      url: `/api/v1/loads/${newId()}`,
    })
    expect(loadRes.statusCode).toBe(404)
  })

  it('AT-19: energy/demand/billing/PF return UNAVAILABLE', async () => {
    for (const path of [
      '/api/v1/analytics/energy',
      '/api/v1/analytics/demand',
      '/api/v1/analytics/billing',
      '/api/v1/analytics/aggregate-pf',
    ]) {
      const res = await app.inject({ method: 'GET', url: path })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.availability).toBe('UNAVAILABLE')
      expect(Array.isArray(body.reason_codes)).toBe(true)
      expect(body.reason_codes.length).toBeGreaterThan(0)
    }
  })

  it('AT-20: no telemetry ingest POST route exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ingest/telemetry',
      payload: { hello: 'world' },
    })
    expect(res.statusCode).toBe(404)
    const routes = app.printRoutes()
    expect(routes).not.toMatch(/ingest\/telemetry/)
  })

  it('AT-21: no API emits LIVE, STALE or OFFLINE in Phase 2a', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sites/${siteId}/overview`,
    })
    const text = res.body
    // data_state fields must not be these (gateway quality enums may exist in DB only)
    const body = res.json()
    const states = [body.data_state, ...body.loads.map((l: { data_state: string }) => l.data_state)]
    for (const s of states) {
      expect(['NO_DATA', 'UNKNOWN']).toContain(s)
    }
    expect(text.includes('"data_state":"LIVE"')).toBe(false)
    expect(text.includes('"data_state":"STALE"')).toBe(false)
    expect(text.includes('"data_state":"OFFLINE"')).toBe(false)
  })
})
