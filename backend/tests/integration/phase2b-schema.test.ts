import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RowDataPacket } from 'mysql2/promise'
import { runMigrations } from '../../src/database/migrate.js'
import { closePools, getMigratePool } from '../../src/database/pool.js'
import { seedCatalogue } from '../../seeds/catalogue.js'
import { newId } from '../../src/utils/ids.js'

async function truncateAll(): Promise<void> {
  const pool = getMigratePool()
  await pool.query('SET FOREIGN_KEY_CHECKS=0')
  for (const table of [
    'metric_mapping_history',
    'metric_mappings',
    'raw_payloads',
    'user_sessions',
    'users',
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

describe('Phase 2b Schema & Migrations Integration', () => {
  beforeAll(async () => {
    await runMigrations()
    await truncateAll()
  })

  afterAll(async () => {
    await closePools()
  })

  it('P2B-01: Migration 004 is recorded in schema_migrations', async () => {
    const [rows] = await getMigratePool().query<RowDataPacket[]>(
      `SELECT version, filename FROM schema_migrations WHERE filename LIKE '%004_phase2b_integration%'`,
    )
    expect(rows.length).toBe(1)
    expect(rows[0]?.version).toBe('004_phase2b_integration')
  })

  it('P2B-02: Default seedCatalogue() seeds EMPTY meters, slave IDs, and mappings', async () => {
    await truncateAll()
    const { siteId, loadCodes } = await seedCatalogue()
    expect(loadCodes).toEqual(['AC-01', 'AC-02', 'AC-03', 'Compressor-01'])

    const pool = getMigratePool()
    const [loads] = await pool.query<RowDataPacket[]>(
      'SELECT id, code FROM loads WHERE site_id = ? ORDER BY sort_order',
      [siteId],
    )
    expect(loads.length).toBe(4)

    const [meters] = await pool.query<RowDataPacket[]>('SELECT id FROM meters WHERE site_id = ?', [siteId])
    expect(meters.length).toBe(0)

    const [assignments] = await pool.query<RowDataPacket[]>(
      'SELECT a.id FROM load_meter_assignments a INNER JOIN loads l ON l.id = a.load_id WHERE l.site_id = ?',
      [siteId],
    )
    expect(assignments.length).toBe(0)

    const [mappings] = await pool.query<RowDataPacket[]>('SELECT id FROM metric_mappings')
    expect(mappings.length).toBe(0)
  })

  it('P2B-03: MySQL composite foreign key (meter_id, source_type) rejects origin mismatch', async () => {
    const pool = getMigratePool()
    const [sites] = await pool.query<RowDataPacket[]>('SELECT id FROM sites LIMIT 1')
    const siteId = String(sites[0]?.id)
    const [loads] = await pool.query<RowDataPacket[]>('SELECT id FROM loads LIMIT 1')
    const loadId = String(loads[0]?.id)
    const [gateways] = await pool.query<RowDataPacket[]>('SELECT id FROM gateways LIMIT 1')
    const gatewayId = String(gateways[0]?.id)

    const realMeterId = newId()
    await pool.query(
      `INSERT INTO meters (id, site_id, source_type, label, status, created_at)
       VALUES (?, ?, 'REAL', 'Bench Real Meter', 'installed', UTC_TIMESTAMP(3))`,
      [realMeterId, siteId],
    )

    const demoMeterId = newId()
    await pool.query(
      `INSERT INTO meters (id, site_id, source_type, label, status, created_at)
       VALUES (?, ?, 'DEMO', 'Bench Demo Meter', 'installed', UTC_TIMESTAMP(3))`,
      [demoMeterId, siteId],
    )

    // Attempting to insert a DEMO sample for a REAL meter must be rejected by foreign key constraint!
    let rejectedMismatch1 = false
    try {
      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, active_power_kw
         ) VALUES (?, ?, ?, ?, 'DEMO', 'testems.telemetry.v1',
           UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 1001, 'OK', 5.5)`,
        [siteId, gatewayId, realMeterId, loadId],
      )
    } catch (err) {
      rejectedMismatch1 = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/foreign key constraint fails.*fk_telemetry_meter_source/i)
    }
    expect(rejectedMismatch1).toBe(true)

    // Attempting to insert a REAL sample for a DEMO meter must also be rejected!
    let rejectedMismatch2 = false
    try {
      await pool.query(
        `INSERT INTO telemetry_samples (
           site_id, gateway_id, meter_id, load_id, source_type, schema_version,
           sample_time, received_at, sequence, quality, active_power_kw
         ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1',
           UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 1002, 'OK', 5.5)`,
        [siteId, gatewayId, demoMeterId, loadId],
      )
    } catch (err) {
      rejectedMismatch2 = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/foreign key constraint fails.*fk_telemetry_meter_source/i)
    }
    expect(rejectedMismatch2).toBe(true)

    // Inserting a matching REAL sample for a REAL meter succeeds
    await pool.query(
      `INSERT INTO telemetry_samples (
         site_id, gateway_id, meter_id, load_id, source_type, schema_version,
         sample_time, received_at, sequence, quality, mapping_version, active_power_kw
       ) VALUES (?, ?, ?, ?, 'REAL', 'testems.telemetry.v1',
         UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), 1003, 'OK', 1, 5.5)`,
      [siteId, gatewayId, realMeterId, loadId],
    )

    const [realSamples] = await pool.query<RowDataPacket[]>(
      'SELECT id, source_type, mapping_version FROM telemetry_samples WHERE meter_id = ?',
      [realMeterId],
    )
    expect(realSamples.length).toBe(1)
    expect(realSamples[0]?.source_type).toBe('REAL')
    expect(realSamples[0]?.mapping_version).toBe(1)
  })

  it('P2B-04: raw_payloads deduplication on (gateway_mac, local_server_ts, payload_hash)', async () => {
    const pool = getMigratePool()
    const gatewayMac = 'AA:BB:CC:DD:EE:01'
    const localServerTs = 1730372400000
    const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    const payloadJson = JSON.stringify({ s1_hold1: 2305, s1_hold2: 2310 })

    await pool.query(
      `INSERT INTO raw_payloads (
         gateway_mac, local_server_ts, payload_hash, payload_json, received_at, mapping_version, decode_status
       ) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), 1, 'SUCCESS')`,
      [gatewayMac, localServerTs, payloadHash, payloadJson],
    )

    // Duplicate insertion with same (gateway_mac, local_server_ts, payload_hash) must fail with duplicate key
    let duplicateRejected = false
    try {
      await pool.query(
        `INSERT INTO raw_payloads (
           gateway_mac, local_server_ts, payload_hash, payload_json, received_at, mapping_version, decode_status
         ) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), 1, 'SUCCESS')`,
        [gatewayMac, localServerTs, payloadHash, payloadJson],
      )
    } catch (err) {
      duplicateRejected = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/Duplicate entry.*uq_raw_payload_dedup/i)
    }
    expect(duplicateRejected).toBe(true)
  })

  it('P2B-05: metric_mappings supports "number" and binary decodes, with append-only history', async () => {
    const pool = getMigratePool()
    const [meters] = await pool.query<RowDataPacket[]>('SELECT id FROM meters LIMIT 1')
    const meterId = String(meters[0]?.id)

    const mappingId = newId()
    await pool.query(
      `INSERT INTO metric_mappings (
         id, meter_id, metric, source_keys, decode, word_order, byte_order, scale, offset, unit,
         verification_status, version, created_at, updated_at
       ) VALUES (?, ?, 'voltage_avg', ?, 'number', 'BE', 'BE', 0.1, 0, 'V', 'UNVERIFIED', 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [mappingId, meterId, JSON.stringify(['s1_hold1'])],
    )

    // Record in history table
    await pool.query(
      `INSERT INTO metric_mapping_history (
         mapping_id, meter_id, metric, source_keys, decode, word_order, byte_order, scale, offset, unit,
         verification_status, version, action, changed_by
       ) VALUES (?, ?, 'voltage_avg', ?, 'number', 'BE', 'BE', 0.1, 0, 'V', 'UNVERIFIED', 1, 'CREATED', 'admin')`,
      [mappingId, meterId, JSON.stringify(['s1_hold1'])],
    )

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, decode, scale, verification_status FROM metric_mappings WHERE id = ?',
      [mappingId],
    )
    expect(rows.length).toBe(1)
    expect(rows[0]?.decode).toBe('number')
    expect(rows[0]?.verification_status).toBe('UNVERIFIED')

    const [histRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, action, version FROM metric_mapping_history WHERE mapping_id = ?',
      [mappingId],
    )
    expect(histRows.length).toBe(1)
    expect(histRows[0]?.action).toBe('CREATED')
    expect(histRows[0]?.version).toBe(1)
  })

  it('P2B-06: users and user_sessions enforce uniqueness and referential integrity', async () => {
    const pool = getMigratePool()
    const userId = newId()
    const username = 'admin_ems'
    const passwordHash = '$argon2id$v=19$m=65536,t=3,p=4$fakehash'

    await pool.query(
      `INSERT INTO users (id, username, password_hash, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [userId, username, passwordHash],
    )

    // Duplicate username must be rejected
    let dupUserRejected = false
    try {
      await pool.query(
        `INSERT INTO users (id, username, password_hash, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [newId(), username, passwordHash],
      )
    } catch (err) {
      dupUserRejected = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/Duplicate entry.*uq_users_username/i)
    }
    expect(dupUserRejected).toBe(true)

    // User session insertion
    const sessionId = 'session_test_token_123'
    await pool.query(
      `INSERT INTO user_sessions (id, user_id, expires_at, created_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 DAY), UTC_TIMESTAMP(3))`,
      [sessionId, userId],
    )

    const [sessions] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id FROM user_sessions WHERE id = ?',
      [sessionId],
    )
    expect(sessions.length).toBe(1)
    expect(sessions[0]?.user_id).toBe(userId)
  })

  it('P2B-07: Migration 005 CHECK constraint rejects VERIFIED status without required evidence', async () => {
    const pool = getMigratePool()
    const [meters] = await pool.query<RowDataPacket[]>('SELECT id FROM meters LIMIT 1')
    const meterId = String(meters[0]?.id)

    const mappingId = newId()
    // 1. Attempting to insert a VERIFIED mapping with NULL verified_by/verified_at/evidence_note must FAIL check constraint
    let checkFailed = false
    try {
      await pool.query(
        `INSERT INTO metric_mappings (
           id, meter_id, metric, source_keys, decode, word_order, byte_order, scale, offset, unit,
           verification_status, verified_by, verified_at, evidence_note, version, created_at, updated_at
         ) VALUES (?, ?, 'current_avg', ?, 'number', 'BE', 'BE', 0.01, 0, 'A', 'VERIFIED', NULL, NULL, NULL, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [mappingId, meterId, JSON.stringify(['s1_hold2'])],
      )
    } catch (err) {
      checkFailed = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/Check constraint 'chk_mm_verified_fields' is violated/i)
    }
    expect(checkFailed).toBe(true)

    // 2. Inserting with UNVERIFIED status succeeds even with null evidence
    await pool.query(
      `INSERT INTO metric_mappings (
         id, meter_id, metric, source_keys, decode, word_order, byte_order, scale, offset, unit,
         verification_status, verified_by, verified_at, evidence_note, version, created_at, updated_at
       ) VALUES (?, ?, 'current_avg', ?, 'number', 'BE', 'BE', 0.01, 0, 'A', 'UNVERIFIED', NULL, NULL, NULL, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [mappingId, meterId, JSON.stringify(['s1_hold2'])],
    )

    // 3. Updating to VERIFIED without evidence must also fail
    let updateFailed = false
    try {
      await pool.query(
        `UPDATE metric_mappings SET verification_status = 'VERIFIED' WHERE id = ?`,
        [mappingId],
      )
    } catch (err) {
      updateFailed = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/Check constraint 'chk_mm_verified_fields' is violated/i)
    }
    expect(updateFailed).toBe(true)

    // 4. Updating to VERIFIED with complete evidence succeeds
    await pool.query(
      `UPDATE metric_mappings SET
         verification_status = 'VERIFIED',
         verified_by = 'qa_engineer',
         verified_at = UTC_TIMESTAMP(3),
         evidence_note = 'Matched against meter display reading 230.5 V'
       WHERE id = ?`,
      [mappingId],
    )

    const [verifiedRow] = await pool.query<RowDataPacket[]>(
      'SELECT verification_status, verified_by FROM metric_mappings WHERE id = ?',
      [mappingId],
    )
    expect(verifiedRow[0]?.verification_status).toBe('VERIFIED')
    expect(verifiedRow[0]?.verified_by).toBe('qa_engineer')

    // 5. Duplicate (meter_id, metric) must fail unique constraint
    let duplicateMetricFailed = false
    try {
      await pool.query(
        `INSERT INTO metric_mappings (
           id, meter_id, metric, source_keys, decode, word_order, byte_order, scale, offset, unit,
           verification_status, version, created_at, updated_at
         ) VALUES (?, ?, 'current_avg', ?, 'number', 'BE', 'BE', 0.01, 0, 'A', 'UNVERIFIED', 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [newId(), meterId, JSON.stringify(['s1_hold3'])],
      )
    } catch (err) {
      duplicateMetricFailed = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/Duplicate entry.*uq_metric_mapping_meter_metric/i)
    }
    expect(duplicateMetricFailed).toBe(true)
  })
})
