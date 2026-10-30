import mysql from 'mysql2/promise'
import { getEnv } from '../config/env.js'

export type DbPool = mysql.Pool

let appPool: DbPool | null = null
let migratePool: DbPool | null = null

const baseOptions = {
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  dateStrings: true,
  timezone: 'Z',
  charset: 'utf8mb4',
} as const

export function getAppPool(): DbPool {
  if (appPool) return appPool
  const env = getEnv()
  appPool = mysql.createPool({
    ...baseOptions,
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  })
  return appPool
}

export function getMigratePool(): DbPool {
  if (migratePool) return migratePool
  const env = getEnv()
  migratePool = mysql.createPool({
    ...baseOptions,
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_MIGRATE_USER,
    password: env.MYSQL_MIGRATE_PASSWORD,
    database: env.MYSQL_DATABASE,
    multipleStatements: true,
  })
  return migratePool
}

export async function closePools(): Promise<void> {
  if (appPool) {
    await appPool.end()
    appPool = null
  }
  if (migratePool) {
    await migratePool.end()
    migratePool = null
  }
}

export async function pingDatabase(pool: DbPool = getAppPool()): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.query('SELECT 1')
  } finally {
    conn.release()
  }
}
