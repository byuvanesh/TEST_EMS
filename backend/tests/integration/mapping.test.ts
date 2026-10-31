/**
 * System Mapping API Integration Tests — Step 4 (Phase 2b)
 *
 * Verifies:
 *  - MAP-01: GET /api/system/mapping returns meters with active mappings
 *  - MAP-02: PUT /api/system/mapping is rejected (401) without authentication
 *  - MAP-03: PUT /api/system/mapping is rejected (403) without CSRF header
 *  - MAP-04: PUT /api/system/mapping is rejected (403) when must_change_password=1
 *  - MAP-05: PUT /api/system/mapping updates mapping, increments version, and writes to metric_mapping_history
 *  - MAP-06: PUT /api/system/mapping rejects VERIFIED status if verification evidence is missing
 *  - MAP-07: POST /api/system/mapping/test returns raw keys next to decoded value
 *  - MAP-08: POST /api/system/mapping/test decodes UNVERIFIED mapping successfully (test mode)
 *  - MAP-09: POST /api/system/mapping/test queries the latest raw_payloads row by meter_id / gateway_mac
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { RowDataPacket } from 'mysql2/promise'
import { buildApp } from '../../src/app.js'
import { runMigrations } from '../../src/database/migrate.js'
import { closePools, getAppPool, getMigratePool } from '../../src/database/pool.js'
import { getEnv } from '../../src/config/env.js'
import { seedCatalogue } from '../../seeds/catalogue.js'

let app: FastifyInstance
let sessionCookie: string
let csrfToken: string
let testMeterId: string
const GATEWAY_MAC = 'AA:BB:CC:DD:EE:99'

beforeAll(async () => {
  await runMigrations()
  // Seed with meters and gateway_meter_links so tests have real rows
  await seedCatalogue({ emptyMetersAndMappings: false })

  const pool = getAppPool()
  const env = getEnv()

  app = await buildApp()
  await app.ready()

  // 1. Ensure admin user exists with must_change_password = 0 for mapping tests
  await pool.query(
    'UPDATE users SET must_change_password = 0 WHERE username = ?',
    ['admin'],
  )

  // 2. Log in as admin to obtain session cookie and CSRF token
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'admin',
      password: env.INITIAL_ADMIN_PASSWORD,
    },
  })
  expect(loginRes.statusCode).toBe(200)
  csrfToken = loginRes.json().csrfToken
  sessionCookie = loginRes.cookies[0]!.value

  // 3. Find a real meter from the seeded catalogue
  const [meterRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM meters LIMIT 1',
  )
  testMeterId = meterRows[0]!.id as string

  // 4. Set the gateway MAC via gateway_meter_links for raw_payloads tests
  const [gwRows] = await pool.query<RowDataPacket[]>(
    'SELECT gml.gateway_id FROM gateway_meter_links gml WHERE gml.meter_id = ? LIMIT 1',
    [testMeterId],
  )
  const gwId = gwRows[0]!.gateway_id as string
  await pool.query('UPDATE gateways SET mac = ? WHERE id = ?', [GATEWAY_MAC, gwId])
})

afterAll(async () => {
  await app.close()
  await closePools()
})

describe('Step 4 — System Mapping API (Phase 2b)', () => {
  // --------------------------------------------------------------------------
  // GET /api/system/mapping
  // --------------------------------------------------------------------------
  it('MAP-01: GET /api/system/mapping returns meters with active mappings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/system/mapping',
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.meters).toBeDefined()
    expect(Array.isArray(body.meters)).toBe(true)
    expect(body.meters.length).toBeGreaterThanOrEqual(1)

    const meter = body.meters.find((m: { id: string }) => m.id === testMeterId)
    expect(meter).toBeDefined()
    expect(meter.label).toBeDefined()
    expect(meter.mappings).toBeDefined()
    expect(Array.isArray(meter.mappings)).toBe(true)
  })

  // --------------------------------------------------------------------------
  // PUT /api/system/mapping Security & Guard enforcement
  // --------------------------------------------------------------------------
  it('MAP-02: PUT /api/system/mapping is rejected (401) without authentication', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      payload: {
        meter_id: testMeterId,
        mappings: [
          {
            metric: 'voltage_l1',
            source_keys: ['reg0'],
            decode: 'number',
          },
        ],
      },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })

  it('MAP-03: PUT /api/system/mapping is rejected (403) without CSRF header', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      cookies: { ems_session: sessionCookie },
      // Omit x-csrf-token
      payload: {
        meter_id: testMeterId,
        mappings: [
          {
            metric: 'voltage_l1',
            source_keys: ['reg0'],
            decode: 'number',
          },
        ],
      },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('CSRF_REJECTED')
  })

  it('MAP-04: PUT /api/system/mapping is rejected (403) when must_change_password=1', async () => {
    const pool = getAppPool()
    // Temporarily set must_change_password = 1 on admin
    await pool.query('UPDATE users SET must_change_password = 1 WHERE username = "admin"')

    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/system/mapping',
        cookies: { ems_session: sessionCookie },
        headers: { 'x-csrf-token': csrfToken },
        payload: {
          meter_id: testMeterId,
          mappings: [
            {
              metric: 'voltage_l1',
              source_keys: ['reg0'],
              decode: 'number',
            },
          ],
        },
      })

      expect(res.statusCode).toBe(403)
      expect(res.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED')
    } finally {
      // Restore must_change_password = 0
      await pool.query('UPDATE users SET must_change_password = 0 WHERE username = "admin"')
    }
  })

  // --------------------------------------------------------------------------
  // PUT /api/system/mapping Functional tests (versioning & history)
  // --------------------------------------------------------------------------
  it('MAP-05: PUT /api/system/mapping updates mapping, increments version, and writes to metric_mapping_history', async () => {
    const pool = getAppPool()

    // 1. Initial PUT: creates version 1
    const res1 = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      cookies: { ems_session: sessionCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        meter_id: testMeterId,
        mappings: [
          {
            metric: 'voltage_l1',
            source_keys: ['s1_hold1', 's1_hold2'],
            decode: 'float32',
            word_order: 'BE',
            byte_order: 'BE',
            scale: 1.0,
            offset: 0.0,
            unit: 'V',
            verification_status: 'UNVERIFIED',
          },
        ],
      },
    })

    expect(res1.statusCode).toBe(200)
    expect(res1.json().ok).toBe(true)

    // Check version 1 in metric_mappings
    const [mm1] = await pool.query<RowDataPacket[]>(
      'SELECT id, version, decode FROM metric_mappings WHERE meter_id = ? AND metric = ?',
      [testMeterId, 'voltage_l1'],
    )
    expect(mm1.length).toBe(1)
    expect(mm1[0]?.version).toBe(1)
    const mappingId = mm1[0]!.id as string

    // Check history row exists for CREATED action
    const [hist1] = await pool.query<RowDataPacket[]>(
      'SELECT version, action, changed_by FROM metric_mapping_history WHERE mapping_id = ? AND version = 1',
      [mappingId],
    )
    expect(hist1.length).toBe(1)
    expect(hist1[0]?.action).toBe('CREATED')
    expect(hist1[0]?.changed_by).toBe('admin')

    // 2. Second PUT: updates mapping, increments version to 2
    const res2 = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      cookies: { ems_session: sessionCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        meter_id: testMeterId,
        mappings: [
          {
            metric: 'voltage_l1',
            source_keys: ['s1_hold1', 's1_hold2'],
            decode: 'float32',
            word_order: 'LE', // Word Swap change
            byte_order: 'BE',
            scale: 0.1,       // Scale change
            offset: 0.0,
            unit: 'kV',
            verification_status: 'UNVERIFIED',
          },
        ],
      },
    })

    expect(res2.statusCode).toBe(200)

    // Check version 2 in metric_mappings
    const [mm2] = await pool.query<RowDataPacket[]>(
      'SELECT version, word_order, scale FROM metric_mappings WHERE id = ?',
      [mappingId],
    )
    expect(mm2[0]?.version).toBe(2)
    expect(mm2[0]?.word_order).toBe('LE')
    expect(Number(mm2[0]?.scale)).toBe(0.1)

    // Check history row exists for UPDATED action
    const [hist2] = await pool.query<RowDataPacket[]>(
      'SELECT version, action, changed_by FROM metric_mapping_history WHERE mapping_id = ? AND version = 2',
      [mappingId],
    )
    expect(hist2.length).toBe(1)
    expect(hist2[0]?.action).toBe('UPDATED')
  })

  it('MAP-06: PUT /api/system/mapping rejects VERIFIED status if verification evidence is missing', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      cookies: { ems_session: sessionCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        meter_id: testMeterId,
        mappings: [
          {
            metric: 'current_l1',
            source_keys: ['s1_hold3'],
            decode: 'uint16',
            verification_status: 'VERIFIED',
            // Missing evidence_note, verified_by, verified_at!
          },
        ],
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VERIFICATION_EVIDENCE_REQUIRED')
  })

  // --------------------------------------------------------------------------
  // POST /api/system/mapping/test — Raw register comparison endpoint
  // --------------------------------------------------------------------------
  it('MAP-07: POST /api/system/mapping/test returns raw keys next to decoded value', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/system/mapping/test',
      cookies: { ems_session: sessionCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        mapping: {
          metric: 'voltage_l1',
          source_keys: ['reg0', 'reg1'],
          decode: 'float32',
          word_order: 'BE',
          byte_order: 'BE',
          scale: 1.0,
          offset: 0.0,
          unit: 'V',
          verification_status: 'UNVERIFIED',
        },
        raw_payload: {
          reg0: 17254,
          reg1: 32768,
        },
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.metric).toBe('voltage_l1')
    expect(body.raw_keys).toEqual({ reg0: 17254, reg1: 32768 })
    expect(body.decoded_value).toBe(230.5)
    expect(body.unit).toBe('V')
  })

  it('MAP-08: POST /api/system/mapping/test decodes UNVERIFIED mapping successfully (test mode)', async () => {
    // In production telemetry, UNVERIFIED mappings yield NULL.
    // In the test endpoint, the whole point is verifying against the meter display,
    // so it MUST return the decoded value even when UNVERIFIED.
    const res = await app.inject({
      method: 'POST',
      url: '/api/system/mapping/test',
      cookies: { ems_session: sessionCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        mapping: {
          metric: 'power_active',
          source_keys: ['hold_kw'],
          decode: 'number',
          scale: 0.01,
          offset: 0.0,
          verification_status: 'UNVERIFIED', // UNVERIFIED!
        },
        raw_payload: {
          hold_kw: 15420,
        },
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.decoded_value).toBe(154.2)
    expect(body.verification_status).toBe('UNVERIFIED')
  })

  it('MAP-09: POST /api/system/mapping/test queries the latest raw_payloads row by meter_id / gateway_mac', async () => {
    const pool = getMigratePool()
    const ts = Date.now() + 50000

    // Insert a known raw payload for GATEWAY_MAC
    const testPayload = { s1_hold1: 17254, s1_hold2: 32768 }
    await pool.query(
      `INSERT INTO raw_payloads
         (gateway_mac, local_server_ts, payload_hash, payload_json, received_at, mapping_version, decode_status)
       VALUES (?, ?, 'dummy_hash_for_test_map_09', ?, UTC_TIMESTAMP(3), 1, 'SUCCESS')`,
      [GATEWAY_MAC, ts, JSON.stringify(testPayload)],
    )

    // Test endpoint using meter_id (resolves gateway_mac automatically)
    const res = await app.inject({
      method: 'POST',
      url: '/api/system/mapping/test',
      cookies: { ems_session: sessionCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        meter_id: testMeterId,
        mapping: {
          metric: 'voltage_l1',
          source_keys: ['s1_hold1', 's1_hold2'],
          decode: 'float32',
          word_order: 'BE',
          byte_order: 'BE',
          verification_status: 'UNVERIFIED',
        },
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.raw_keys['s1_hold1']).toBe(17254)
    expect(body.raw_keys['s1_hold2']).toBe(32768)
    expect(body.decoded_value).toBe(230.5)
    expect(body.local_server_ts).toBe(ts)
  })
})

// ---------------------------------------------------------------------------
// GET /api/system/config tests
// CFG-01  Requires authentication
// CFG-02  Returns local_server_url when authenticated
// CFG-03  Never leaks credentials (LOCAL_SERVER_USER, LOCAL_SERVER_PASSWORD, GATEWAY_MAC)
// ---------------------------------------------------------------------------

describe('GET /api/system/config', () => {
  it('CFG-01: returns 401 without a session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/system/config',
    })
    expect(res.statusCode).toBe(401)
  })

  it('CFG-02: returns 200 with local_server_url when authenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/system/config',
      cookies: { ems_session: sessionCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(typeof body.local_server_url).toBe('string')
    // Should be a non-empty string (default or configured)
    expect((body.local_server_url as string).length).toBeGreaterThan(0)
  })

  it('CFG-03: response body never contains credential fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/system/config',
      cookies: { ems_session: sessionCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>

    // Credential fields must be absent — not just falsy, but absent entirely
    expect('LOCAL_SERVER_USER' in body).toBe(false)
    expect('LOCAL_SERVER_PASSWORD' in body).toBe(false)
    expect('GATEWAY_MAC' in body).toBe(false)
    // Also check lowercased variants
    expect('local_server_user' in body).toBe(false)
    expect('local_server_password' in body).toBe(false)
    expect('gateway_mac' in body).toBe(false)
  })
})
