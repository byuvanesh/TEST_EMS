import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getBackendRoot } from '../config/env.js'
import { getMigratePool } from './pool.js'

const LOCK_NAME = 'test_ems_migrations'
const LOCK_TIMEOUT_SEC = 30

export interface MigrationResult {
  applied: string[]
  alreadyApplied: string[]
  checksumVerified: string[]
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

async function ensureMigrationsTable(conn: PoolConnection): Promise<void> {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(128) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `)
}

async function acquireLock(conn: PoolConnection): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT GET_LOCK(?, ?) AS got',
    [LOCK_NAME, LOCK_TIMEOUT_SEC],
  )
  const got = rows[0]?.got
  if (got !== 1) {
    throw new Error(
      `Could not acquire migration lock '${LOCK_NAME}' within ${LOCK_TIMEOUT_SEC}s`,
    )
  }
}

async function releaseLock(conn: PoolConnection): Promise<void> {
  await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME])
}

async function listMigrationFiles(): Promise<Array<{ version: string; filename: string; fullPath: string }>> {
  const dir = path.join(getBackendRoot(), 'migrations')
  const files = (await readdir(dir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  return files.map((filename) => {
    const version = filename.replace(/\.sql$/i, '')
    return {
      version,
      filename,
      fullPath: path.join(dir, filename),
    }
  })
}

export async function runMigrations(): Promise<MigrationResult> {
  const pool = getMigratePool()
  const conn = await pool.getConnection()
  const applied: string[] = []
  const alreadyApplied: string[] = []
  const checksumVerified: string[] = []

  try {
    await acquireLock(conn)
    await ensureMigrationsTable(conn)

    const files = await listMigrationFiles()
    const [existingRows] = await conn.query<RowDataPacket[]>(
      'SELECT version, filename, checksum FROM schema_migrations ORDER BY version',
    )
    const existing = new Map(
      existingRows.map((r) => [
        String(r.version),
        { filename: String(r.filename), checksum: String(r.checksum) },
      ]),
    )

    for (const file of files) {
      const sql = await readFile(file.fullPath, 'utf8')
      const checksum = sha256(sql)
      const prev = existing.get(file.version)

      if (prev) {
        if (prev.checksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${file.filename}: stored=${prev.checksum} current=${checksum}. Refusing to continue.`,
          )
        }
        checksumVerified.push(file.filename)
        alreadyApplied.push(file.filename)
        continue
      }

      // MySQL DDL is not fully transactional; apply file then record.
      try {
        await conn.query(sql)
        await conn.query<ResultSetHeader>(
          `INSERT INTO schema_migrations (version, filename, checksum, applied_at)
           VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
          [file.version, file.filename, checksum],
        )
        applied.push(file.filename)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throw new Error(
          `Migration failed on ${file.filename}: ${message}. Partial DDL may have been applied; inspect the database before retrying.`,
        )
      }
    }

    return { applied, alreadyApplied, checksumVerified }
  } finally {
    try {
      await releaseLock(conn)
    } finally {
      conn.release()
    }
  }
}

/** Test helper: compute checksum of a migration file by version prefix match. */
export async function checksumMigrationFile(filename: string): Promise<string> {
  const fullPath = path.join(getBackendRoot(), 'migrations', filename)
  const sql = await readFile(fullPath, 'utf8')
  return sha256(sql)
}

export async function getStoredMigrationChecksum(version: string): Promise<string | null> {
  const pool = getMigratePool()
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT checksum FROM schema_migrations WHERE version = ?',
    [version],
  )
  const row = rows[0]
  return row ? String(row.checksum) : null
}

export async function forceUpdateStoredChecksum(
  version: string,
  checksum: string,
): Promise<void> {
  const pool = getMigratePool()
  await pool.query('UPDATE schema_migrations SET checksum = ? WHERE version = ?', [
    checksum,
    version,
  ])
}
