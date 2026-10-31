import bcrypt from 'bcrypt'
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto'

const BCRYPT_SALT_ROUNDS = 10

/**
 * Hash a user password using bcrypt with 10 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
}

/**
 * Compare a plaintext password with a bcrypt password hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a cryptographically secure 32-byte (64 hex characters) session token.
 * This raw token is returned to the client as an HttpOnly session cookie.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Compute the SHA-256 hash of a raw session token.
 * Per H7, ONLY this hash is stored in user_sessions.id; the raw token is never persisted in the DB.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Derive an HMAC-SHA256 CSRF token cryptographically bound to the raw session token.
 * This token is sent to the client in JSON responses and must be provided via the
 * X-CSRF-Token header on state-changing requests.
 */
export function deriveCsrfToken(rawSessionToken: string, secret: string): string {
  return createHmac('sha256', secret).update(rawSessionToken).digest('hex')
}

/**
 * Constant-time verification of a CSRF token against the expected derived token.
 */
export function verifyCsrfToken(
  rawSessionToken: string,
  providedCsrfToken: string,
  secret: string,
): boolean {
  if (!providedCsrfToken || typeof providedCsrfToken !== 'string') return false
  const expected = deriveCsrfToken(rawSessionToken, secret)
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(providedCsrfToken, 'utf8')
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}
