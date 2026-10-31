import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RowDataPacket } from 'mysql2/promise'
import { runMigrations, forceUpdateStoredChecksum, getStoredMigrationChecksum } from '../../src/database/migrate.js'
import { getMigratePool, closePools } from '../../src/database/pool.js'
import { seedCatalogue } from '../../seeds/catalogue.js'
import { newId } from '../../src/utils/ids.js'

async function truncateCatalogue(): Promise<void> {
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

describe('database integration (MySQL 8)', () => {
  beforeAll(async () => {
    await runMigrations()
    await truncateCatalogue()
    await seedCatalogue({ emptyMetersAndMappings: false })
  })

  it('AT-01: migrations are applied (schema_migrations has entries)', async () => {
    const [rows] = await getMigratePool().query<RowDataPacket[]>(
      'SELECT version, filename, checksum FROM schema_migrations ORDER BY version',
    )
    expect(rows.length).toBeGreaterThanOrEqual(3)
    expect(rows.some((r) => String(r.filename).includes('002_core_catalogue'))).toBe(true)
  })

  it('AT-02: catalogue seed creates exactly four confirmed load codes', async () => {
    const [rows] = await getMigratePool().query<RowDataPacket[]>(
      'SELECT code FROM loads ORDER BY sort_order',
    )
    expect(rows.map((r) => r.code)).toEqual([
      'AC-01',
      'AC-02',
      'AC-03',
      'Compressor-01',
    ])
  })

  it('AT-03: compressor capacity remains TBD', async () => {
    const [rows] = await getMigratePool().query<RowDataPacket[]>(
      `SELECT capacity_label FROM loads WHERE code = 'Compressor-01'`,
    )
    expect(rows[0]?.capacity_label).toBe('Capacity TBD')
  })

  it('AT-04: unverified meter/gateway fields remain NULL/FALSE', async () => {
    const [meters] = await getMigratePool().query<RowDataPacket[]>(
      `SELECT modbus_slave_id, ct_primary_a, ct_secondary_a, register_map_ref FROM meters`,
    )
    expect(meters.length).toBeGreaterThan(0)
    for (const m of meters) {
      expect(m.modbus_slave_id).toBeNull()
      expect(m.ct_primary_a).toBeNull()
      expect(m.ct_secondary_a).toBeNull()
      expect(m.register_map_ref).toBeNull()
    }

    const [gateways] = await getMigratePool().query<RowDataPacket[]>(
      `SELECT auth_key_hash, rs485_master_verified FROM gateways`,
    )
    expect(gateways[0]?.auth_key_hash).toBeNull()
    expect(Number(gateways[0]?.rs485_master_verified)).toBe(0)
  })

  it('AT-05/AT-06: generated-column uniqueness for active assignments', async () => {
    const pool = getMigratePool()
    const [loads] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM loads WHERE code = 'AC-01' LIMIT 1`,
    )
    const loadId = String(loads[0]?.id)
    const [meters] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM meters WHERE site_id = (SELECT site_id FROM loads WHERE id = ?) LIMIT 2`,
      [loadId],
    )
    // Ensure two meters exist for the site
    let meterA = meters[0] ? String(meters[0].id) : null
    let meterB = meters[1] ? String(meters[1].id) : null
    if (!meterB) {
      const [sites] = await pool.query<RowDataPacket[]>(
        'SELECT site_id AS id FROM loads WHERE id = ?',
        [loadId],
      )
      meterB = newId()
      await pool.query(
        `INSERT INTO meters (id, site_id, label, status, created_at,
          modbus_slave_id, ct_primary_a, ct_secondary_a, register_map_ref)
         VALUES (?, ?, 'extra-meter', 'planned', UTC_TIMESTAMP(3), NULL, NULL, NULL, NULL)`,
        [meterB, String(sites[0]?.id)],
      )
    }
    if (!meterA) throw new Error('missing meterA')

    // Close any existing active assignment for AC-01 for a clean test
    await pool.query(
      `UPDATE load_meter_assignments SET valid_to = UTC_TIMESTAMP(3)
       WHERE load_id = ? AND valid_to IS NULL`,
      [loadId],
    )

    const asg1 = newId()
    await pool.query(
      `INSERT INTO load_meter_assignments (id, load_id, meter_id, valid_from, valid_to)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3), NULL)`,
      [asg1, loadId, meterA],
    )

    let rejected = false
    try {
      await pool.query(
        `INSERT INTO load_meter_assignments (id, load_id, meter_id, valid_from, valid_to)
         VALUES (?, ?, ?, UTC_TIMESTAMP(3), NULL)`,
        [newId(), loadId, meterB],
      )
    } catch (err) {
      rejected = true
      const msg = err instanceof Error ? err.message : String(err)
      expect(msg).toMatch(/Duplicate|uq_lma_one_active_per_load/i)
    }
    expect(rejected).toBe(true)

    await pool.query(
      `UPDATE load_meter_assignments SET valid_to = UTC_TIMESTAMP(3) WHERE id = ?`,
      [asg1],
    )
    await pool.query(
      `INSERT INTO load_meter_assignments (id, load_id, meter_id, valid_from, valid_to)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3), NULL)`,
      [newId(), loadId, meterB],
    )

    // Historical rows still valid
    await pool.query(
      `INSERT INTO load_meter_assignments (id, load_id, meter_id, valid_from, valid_to)
       VALUES (?, ?, ?, '2026-01-01 00:00:00.000', '2026-01-02 00:00:00.000')`,
      [newId(), loadId, meterA],
    )
  })

  it('AT-07: CHECK constraints are enforced', async () => {
    const pool = getMigratePool()
    const [sites] = await pool.query<RowDataPacket[]>('SELECT id FROM sites LIMIT 1')
    const siteId = String(sites[0]?.id)
    let failed = false
    try {
      await pool.query(
        `INSERT INTO meters (id, site_id, label, status, created_at)
         VALUES (?, ?, 'bad-status', 'not-a-status', UTC_TIMESTAMP(3))`,
        [newId(), siteId],
      )
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it('AT-08: migration checksum mismatch is detected', async () => {
    const version = '003_telemetry_samples'
    const original = await getStoredMigrationChecksum(version)
    expect(original).toBeTruthy()
    await forceUpdateStoredChecksum(version, '0'.repeat(64))
    let detected = false
    try {
      await runMigrations()
    } catch (err) {
      detected = true
      expect(String(err)).toMatch(/checksum mismatch/i)
    } finally {
      await forceUpdateStoredChecksum(version, original!)
    }
    expect(detected).toBe(true)
    // Restore clean state
    await runMigrations()
  })

  // Housekeeping H4: Confirm MySQL version >= 8.0 and that CHECK constraints
  // are enforced by the database engine (not just application-level validation).
  it('H4-AT-09: MySQL version is 8.0 or later', async () => {
    const [rows] = await getMigratePool().query<RowDataPacket[]>('SELECT VERSION() AS v')
    const version = String(rows[0]?.v ?? '')
    const major = parseInt(version.split('.')[0] ?? '0', 10)
    expect(major).toBeGreaterThanOrEqual(8)
  })

  it('H4-AT-10: CHECK constraint violation is rejected by MySQL engine (not application)', async () => {
    // The meters table has chk_meter_status CHECK (status IN ('planned','installed','retired','offline'))
    // Attempt to insert a row with an invalid status directly via the DB pool — no application code path.
    const pool = getMigratePool()
    const [sites] = await pool.query<RowDataPacket[]>('SELECT id FROM sites LIMIT 1')
    const siteId = String(sites[0]?.id)
    let constraintRejected = false
    let errorMsg = ''
    try {
      await pool.query(
        `INSERT INTO meters (id, site_id, label, status, created_at)
         VALUES (UUID(), ?, 'H4-guard-meter', 'INVALID_STATUS_XYZ', UTC_TIMESTAMP(3))`,
        [siteId],
      )
    } catch (err) {
      constraintRejected = true
      errorMsg = err instanceof Error ? err.message : String(err)
    }
    expect(constraintRejected).toBe(true)
    // MySQL 8 returns: "Check constraint 'chk_meter_status' is violated."
    expect(errorMsg).toMatch(/Check constraint.*is violated/i)
  })
})

afterAll(async () => {
  await closePools()
})
