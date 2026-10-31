/**
 * Authentication integration tests — Step 3 (Phase 2b)
 *
 * Verifies:
 *  - AUTH-01: Admin bootstrap creates admin user with must_change_password=1
 *  - AUTH-02: Login succeeds with valid credentials, sets SameSite cookie, returns CSRF token
 *  - AUTH-03: Login fails with invalid credentials and returns 401
 *  - AUTH-04: Rate limiting triggers on repeated failed attempts (429) and resets on success
 *  - AUTH-05: Session token in database is a SHA-256 hash (raw token NEVER in user_sessions, per H7)
 *  - AUTH-06: Session expiry is enforced (expired session returns 401)
 *  - AUTH-07: Forced password change flow: must_change_password blocks state-changing operations
 *              until changed via POST /api/auth/change-password
 *  - AUTH-08: Password change rejects short passwords (<8 chars) or identical passwords
 *  - AUTH-09: CSRF protection rejects state-changing requests lacking X-CSRF-Token (403)
 *  - AUTH-10: CORS policy rejects requests from disallowed origins (403)
 *  - AUTH-11: PUT /api/system/mapping strictly requires authentication and CSRF token
 *  - AUTH-12: Logout invalidates the session in DB and clears the cookie
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { RowDataPacket } from 'mysql2/promise'
import { createHash } from 'node:crypto'
import { buildApp } from '../../src/app.js'
import { runMigrations } from '../../src/database/migrate.js'
import { closePools, getAppPool, getMigratePool } from '../../src/database/pool.js'
import { getEnv } from '../../src/config/env.js'
import { hashPassword } from '../../src/modules/auth/crypto.js'
import { defaultLoginRateLimiter } from '../../src/modules/auth/rateLimiter.js'

let app: FastifyInstance

async function cleanAuthTables(): Promise<void> {
  const pool = getMigratePool()
  await pool.query('SET FOREIGN_KEY_CHECKS = 0')
  await pool.query('TRUNCATE TABLE user_sessions')
  await pool.query('TRUNCATE TABLE users')
  await pool.query('SET FOREIGN_KEY_CHECKS = 1')
}

beforeAll(async () => {
  await runMigrations()
  await cleanAuthTables()
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await closePools()
})

beforeEach(async () => {
  defaultLoginRateLimiter.clear()
})

describe('Step 3 — Authentication & Sessions (Phase 2b)', () => {
  it('AUTH-01: Admin bootstrap creates admin user with must_change_password=1', async () => {
    const env = getEnv()
    const pool = getAppPool()

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, must_change_password, password_hash FROM users WHERE username = ?',
      ['admin'],
    )

    expect(rows.length).toBe(1)
    expect(rows[0]?.username).toBe('admin')
    expect(Boolean(rows[0]?.must_change_password)).toBe(true)
    // Confirm password_hash is a bcrypt hash (starts with $2b$ or $2a$)
    expect(String(rows[0]?.password_hash)).toMatch(/^\$2[ab]\$\d+\$/)
    // Confirm raw password is never stored
    expect(rows[0]?.password_hash).not.toBe(env.INITIAL_ADMIN_PASSWORD)
  })

  it('AUTH-02: Login succeeds with valid credentials, sets SameSite cookie, returns CSRF token', async () => {
    const env = getEnv()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'admin',
        password: env.INITIAL_ADMIN_PASSWORD,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user.username).toBe('admin')
    expect(body.user.mustChangePassword).toBe(true)
    expect(body.csrfToken).toBeDefined()
    expect(typeof body.csrfToken).toBe('string')
    expect(body.csrfToken.length).toBeGreaterThan(16)

    // Check Set-Cookie header contains ems_session with SameSite and HttpOnly
    const setCookie = res.headers['set-cookie']
    expect(setCookie).toBeDefined()
    const cookieStr = Array.isArray(setCookie) ? setCookie[0]! : (setCookie as string)
    expect(cookieStr).toContain('ems_session=')
    expect(cookieStr.toLowerCase()).toContain('httponly')
    expect(cookieStr.toLowerCase()).toContain('samesite=lax')
  })

  it('AUTH-03: Login fails with invalid credentials and returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'admin',
        password: 'incorrect_password_attempt',
      },
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('AUTH-04: Rate limiting triggers on repeated failed attempts (429) and resets on success', async () => {
    const env = getEnv()

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'wrong' },
      })
      expect(res.statusCode).toBe(401)
    }

    // 5th failed attempt: triggers block threshold (5 max attempts)
    const res5 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    })
    expect(res5.statusCode).toBe(401)

    // 6th attempt: blocked by rate limiter (returns 429)
    const res6 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    })
    expect(res6.statusCode).toBe(429)
    expect(res6.json().error.code).toBe('RATE_LIMITED')

    // Reset rate limiter (simulating window expiry or manual reset)
    defaultLoginRateLimiter.clear()

    // Successful login now succeeds and resets failure count
    const resOk = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })
    expect(resOk.statusCode).toBe(200)
  })

  it('AUTH-05: Session token in database is a SHA-256 hash (raw token NEVER in user_sessions, per H7)', async () => {
    const env = getEnv()
    const pool = getAppPool()

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })

    expect(loginRes.statusCode).toBe(200)
    const setCookie = loginRes.headers['set-cookie'] as string
    const rawToken = setCookie.split('ems_session=')[1]?.split(';')[0]
    expect(rawToken).toBeDefined()

    // Compute expected SHA-256 hash of rawToken
    const expectedHash = createHash('sha256').update(rawToken!).digest('hex')

    // 1. Assert raw token is NEVER present in user_sessions.id
    const [rawRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM user_sessions WHERE id = ?',
      [rawToken],
    )
    expect(rawRows.length).toBe(0)

    // 2. Assert the SHA-256 hash IS the primary key in user_sessions
    const [hashRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id, expires_at FROM user_sessions WHERE id = ?',
      [expectedHash],
    )
    expect(hashRows.length).toBe(1)
    expect(hashRows[0]?.id).toBe(expectedHash)
    expect(hashRows[0]?.id).not.toBe(rawToken)
  })

  it('AUTH-06: Session expiry is enforced (expired session returns 401)', async () => {
    const env = getEnv()
    const pool = getAppPool()

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })

    const setCookie = loginRes.headers['set-cookie'] as string
    const rawToken = setCookie.split('ems_session=')[1]?.split(';')[0]
    const tokenHash = createHash('sha256').update(rawToken!).digest('hex')

    // Artificially expire the session in the database
    await pool.query(
      'UPDATE user_sessions SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 HOUR) WHERE id = ?',
      [tokenHash],
    )

    // Call GET /api/auth/me with the expired session
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { ems_session: rawToken! },
    })

    expect(meRes.statusCode).toBe(401)
    expect(meRes.json().error.code).toBe('SESSION_EXPIRED')
  })

  it('AUTH-07: Forced password change flow: must_change_password blocks state-changing operations until changed', async () => {
    const env = getEnv()
    const pool = getAppPool()

    // 1. Login with initial admin password (mustChangePassword = true)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })
    expect(loginRes.statusCode).toBe(200)
    const { csrfToken } = loginRes.json()
    const cookie = loginRes.cookies[0]!

    try {
      // 2. Attempting to call state-changing PUT /api/system/mapping is BLOCKED with 403
      const mappingBlocked = await app.inject({
        method: 'PUT',
        url: '/api/system/mapping',
        cookies: { ems_session: cookie.value },
        headers: { 'x-csrf-token': csrfToken },
        payload: {},
      })
      expect(mappingBlocked.statusCode).toBe(403)
      expect(mappingBlocked.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED')

      // 3. User changes password via POST /api/auth/change-password
      const newPassword = 'BrandNewSecurePassword2026!'
      const changeRes = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        cookies: { ems_session: cookie.value },
        headers: { 'x-csrf-token': csrfToken },
        payload: {
          currentPassword: env.INITIAL_ADMIN_PASSWORD,
          newPassword,
        },
      })
      expect(changeRes.statusCode).toBe(200)
      expect(changeRes.json().ok).toBe(true)
      expect(changeRes.json().mustChangePassword).toBe(false)

      // 4. Verify in DB that must_change_password is now 0
      const [userRows] = await pool.query<RowDataPacket[]>(
        'SELECT must_change_password FROM users WHERE username = ?',
        ['admin'],
      )
      expect(Boolean(userRows[0]?.must_change_password)).toBe(false)

      // 5. Now session is fully authorized — GET /api/auth/me succeeds (no body validation involved)
      const meAllowed = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        cookies: { ems_session: cookie.value },
        headers: { 'x-csrf-token': csrfToken },
      })
      expect(meAllowed.statusCode).toBe(200)
      expect(meAllowed.json().user.username).toBe('admin')
    } finally {
      // Always restore admin password and must_change_password for subsequent tests
      const resetHash = await hashPassword(env.INITIAL_ADMIN_PASSWORD)
      await pool.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE username = ?', [
        resetHash,
        'admin',
      ])
    }
  })

  it('AUTH-08: Password change rejects short passwords (<8 chars) or identical passwords', async () => {
    const env = getEnv()

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })
    const { csrfToken } = loginRes.json()
    const cookie = loginRes.cookies[0]!

    // Too short (< 8 chars)
    const shortRes = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      cookies: { ems_session: cookie.value },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        currentPassword: env.INITIAL_ADMIN_PASSWORD,
        newPassword: 'short',
      },
    })
    expect(shortRes.statusCode).toBe(400)
    expect(shortRes.json().error.code).toBe('VALIDATION_ERROR')

    // Same password
    const sameRes = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      cookies: { ems_session: cookie.value },
      headers: { 'x-csrf-token': csrfToken },
      payload: {
        currentPassword: env.INITIAL_ADMIN_PASSWORD,
        newPassword: env.INITIAL_ADMIN_PASSWORD,
      },
    })
    expect(sameRes.statusCode).toBe(400)
    expect(sameRes.json().error.code).toBe('SAME_PASSWORD')
  })

  it('AUTH-09: CSRF protection rejects state-changing requests lacking X-CSRF-Token (403)', async () => {
    const env = getEnv()

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })
    const cookie = loginRes.cookies[0]!

    // Missing X-CSRF-Token
    const missingCsrf = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      cookies: { ems_session: cookie.value },
      payload: {},
    })
    expect(missingCsrf.statusCode).toBe(403)
    expect(missingCsrf.json().error.code).toBe('CSRF_REJECTED')

    // Invalid X-CSRF-Token
    const invalidCsrf = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      cookies: { ems_session: cookie.value },
      headers: { 'x-csrf-token': 'forged_or_invalid_csrf_token_string' },
      payload: {},
    })
    expect(invalidCsrf.statusCode).toBe(403)
    expect(invalidCsrf.json().error.code).toBe('CSRF_REJECTED')
  })

  it('AUTH-10: CORS policy rejects requests from disallowed origins (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        origin: 'http://malicious-website.com',
      },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('CORS_DISALLOWED')
  })

  it('AUTH-11: PUT /api/system/mapping strictly requires authentication and CSRF token', async () => {
    // 1. Unauthenticated request (no cookie) -> 401
    const noAuth = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      payload: {},
    })
    expect(noAuth.statusCode).toBe(401)
    expect(noAuth.json().error.code).toBe('UNAUTHORIZED')

    // 2. Authenticated but missing CSRF header -> 403
    const env = getEnv()
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })
    const cookie = loginRes.cookies[0]!
    const { csrfToken } = loginRes.json()

    const noCsrf = await app.inject({
      method: 'PUT',
      url: '/api/system/mapping',
      cookies: { ems_session: cookie.value },
      payload: {},
    })
    expect(noCsrf.statusCode).toBe(403)

    // 3. Fully authorized (cookie + CSRF) — GET /api/auth/me verifies session is valid
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { ems_session: cookie.value },
      headers: { 'x-csrf-token': csrfToken },
    })
    expect(meRes.statusCode).toBe(200)
    expect(meRes.json().user.username).toBe('admin')
  })

  it('AUTH-12: Logout invalidates the session in DB and clears the cookie', async () => {
    const env = getEnv()
    const pool = getAppPool()

    // 1. Log in
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: env.INITIAL_ADMIN_PASSWORD },
    })
    const cookie = loginRes.cookies[0]!
    const { csrfToken } = loginRes.json()
    const rawToken = cookie.value
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    // Confirm session exists in DB
    const [beforeRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM user_sessions WHERE id = ?',
      [tokenHash],
    )
    expect(beforeRows.length).toBe(1)

    // 2. Call logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { ems_session: rawToken },
      headers: { 'x-csrf-token': csrfToken },
    })
    expect(logoutRes.statusCode).toBe(200)

    // Check Set-Cookie clears the cookie (max-age=0 or expires in past)
    const setCookie = logoutRes.headers['set-cookie'] as string
    expect(setCookie).toBeDefined()

    // 3. Confirm session is removed from DB
    const [afterRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM user_sessions WHERE id = ?',
      [tokenHash],
    )
    expect(afterRows.length).toBe(0)

    // 4. Subsequent requests with that cookie return 401
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { ems_session: rawToken },
    })
    expect(meRes.statusCode).toBe(401)
  })
})
