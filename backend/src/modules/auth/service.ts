import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from '../../database/pool.js'
import type { AppEnv } from '../../config/env.js'
import { AppError, badRequest, notFound } from '../../utils/errors.js'
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  deriveCsrfToken,
} from './crypto.js'
import { defaultLoginRateLimiter, type LoginRateLimiter } from './rateLimiter.js'
import { randomUUID } from 'node:crypto'

export interface AuthUser {
  id: string
  username: string
  mustChangePassword: boolean
}

export interface LoginResult {
  user: AuthUser
  rawToken: string
  csrfToken: string
}

export interface SessionData {
  sessionId: string
  user: AuthUser
}

/**
 * Bootstrap the initial admin user if no admin exists in the users table.
 * Reads the initial password strictly from env.INITIAL_ADMIN_PASSWORD.
 * The must_change_password flag is always set to 1 on initial creation.
 */
export async function bootstrapAdminUser(pool: DbPool, env: AppEnv): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
    ['admin'],
  )

  if (rows.length > 0) {
    // Admin already exists, never overwrite
    return
  }

  if (!env.INITIAL_ADMIN_PASSWORD || env.INITIAL_ADMIN_PASSWORD.trim() === '') {
    // No initial admin password configured in environment, skip creation
    return
  }

  const hash = await hashPassword(env.INITIAL_ADMIN_PASSWORD)
  const id = randomUUID()

  await pool.query(
    `INSERT INTO users (id, username, password_hash, must_change_password, created_at, updated_at)
     VALUES (?, 'admin', ?, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
    [id, hash],
  )
}

/**
 * Authenticate a user by username and password.
 * Rate-limits failed login attempts by client IP and username.
 * Generates an ephemeral session token whose SHA-256 hash is persisted in user_sessions (per H7).
 */
export async function login(
  pool: DbPool,
  env: AppEnv,
  username: string,
  password: string,
  clientIp: string,
  rateLimiter: LoginRateLimiter = defaultLoginRateLimiter,
): Promise<LoginResult> {
  // Check rate limit by IP or username
  if (rateLimiter.isBlocked(clientIp) || rateLimiter.isBlocked(username)) {
    throw new AppError(429, 'RATE_LIMITED', 'Too many failed login attempts. Please try again later.')
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, password_hash, must_change_password FROM users WHERE username = ? LIMIT 1',
    [username],
  )

  const user = rows[0]
  const isValid = user ? await verifyPassword(password, user.password_hash as string) : false

  if (!isValid || !user) {
    rateLimiter.recordFailure(clientIp)
    rateLimiter.recordFailure(username)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
  }

  // Login successful: reset rate limiter for this IP and username
  rateLimiter.reset(clientIp)
  rateLimiter.reset(username)

  const rawToken = generateSessionToken()
  const tokenHash = hashSessionToken(rawToken)
  const csrfToken = deriveCsrfToken(rawToken, env.SESSION_SECRET)

  // Session lasts 24 hours. Only the token hash is stored in user_sessions.id (H7)
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 24 HOUR), UTC_TIMESTAMP(3))`,
    [tokenHash, user.id],
  )

  return {
    user: {
      id: user.id as string,
      username: user.username as string,
      mustChangePassword: Boolean(user.must_change_password),
    },
    rawToken,
    csrfToken,
  }
}

/**
 * Validate an active session using the raw session token from the cookie.
 * Computes the SHA-256 hash to look up the session in user_sessions.
 */
export async function validateSession(
  pool: DbPool,
  rawToken: string,
): Promise<SessionData | null> {
  if (!rawToken || typeof rawToken !== 'string') {
    return null
  }

  const tokenHash = hashSessionToken(rawToken)

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.username, u.must_change_password
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3)
     LIMIT 1`,
    [tokenHash],
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]!
  return {
    sessionId: row.session_id as string,
    user: {
      id: row.user_id as string,
      username: row.username as string,
      mustChangePassword: Boolean(row.must_change_password),
    },
  }
}

/**
 * Terminate a session by removing its hash from user_sessions.
 */
export async function logout(pool: DbPool, rawToken: string): Promise<void> {
  if (!rawToken || typeof rawToken !== 'string') return
  const tokenHash = hashSessionToken(rawToken)
  await pool.query('DELETE FROM user_sessions WHERE id = ?', [tokenHash])
}

/**
 * Force password change flow.
 * Validates current password, enforces minimum length of 8 chars,
 * hashes the new password with bcrypt, and clears must_change_password flag to 0.
 */
export async function changePassword(
  pool: DbPool,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!newPassword || newPassword.length < 8) {
    throw badRequest('PASSWORD_TOO_SHORT', 'New password must be at least 8 characters long')
  }

  if (newPassword === currentPassword) {
    throw badRequest('SAME_PASSWORD', 'New password must be different from current password')
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
    [userId],
  )

  if (rows.length === 0) {
    throw notFound('USER_NOT_FOUND', 'User not found')
  }

  const user = rows[0]!
  const isCurrentValid = await verifyPassword(currentPassword, user.password_hash as string)

  if (!isCurrentValid) {
    throw badRequest('INVALID_CURRENT_PASSWORD', 'Current password is incorrect')
  }

  const newHash = await hashPassword(newPassword)

  await pool.query(
    `UPDATE users
     SET password_hash = ?, must_change_password = 0, updated_at = UTC_TIMESTAMP(3)
     WHERE id = ?`,
    [newHash, userId],
  )
}
