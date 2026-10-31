export interface RateLimiterOptions {
  maxAttempts?: number
  windowMs?: number
}

interface AttemptRecord {
  count: number
  firstAttemptAt: number
  blockedUntil: number | null
}

export class LoginRateLimiter {
  private readonly maxAttempts: number
  private readonly windowMs: number
  private readonly attempts = new Map<string, AttemptRecord>()

  constructor(opts: RateLimiterOptions = {}) {
    this.maxAttempts = opts.maxAttempts ?? 5
    this.windowMs = opts.windowMs ?? 15 * 60 * 1000 // 15 minutes default
  }

  /**
   * Check if the key (e.g., client IP or username) is currently blocked.
   */
  isBlocked(key: string, now = Date.now()): boolean {
    const record = this.attempts.get(key)
    if (!record) return false

    // Window expired
    if (now - record.firstAttemptAt > this.windowMs) {
      this.attempts.delete(key)
      return false
    }

    if (record.blockedUntil !== null && now < record.blockedUntil) {
      return true
    }

    return record.count >= this.maxAttempts
  }

  /**
   * Get the number of failed attempts recorded within the active window.
   */
  getAttempts(key: string, now = Date.now()): number {
    const record = this.attempts.get(key)
    if (!record) return 0
    if (now - record.firstAttemptAt > this.windowMs) {
      this.attempts.delete(key)
      return 0
    }
    return record.count
  }

  /**
   * Record a failed attempt.
   */
  recordFailure(
    key: string,
    now = Date.now(),
  ): { count: number; blocked: boolean; retryAfterSeconds: number } {
    let record = this.attempts.get(key)

    if (!record || now - record.firstAttemptAt > this.windowMs) {
      record = { count: 1, firstAttemptAt: now, blockedUntil: null }
      this.attempts.set(key, record)
    } else {
      record.count += 1
    }

    const blocked = record.count >= this.maxAttempts
    if (blocked && record.blockedUntil === null) {
      record.blockedUntil = now + this.windowMs
    }

    const remainingMs = record.blockedUntil ? Math.max(0, record.blockedUntil - now) : 0
    const retryAfterSeconds = Math.ceil(remainingMs / 1000)

    return {
      count: record.count,
      blocked,
      retryAfterSeconds,
    }
  }

  /**
   * Reset attempts for a key (called on successful login).
   */
  reset(key: string): void {
    this.attempts.delete(key)
  }

  /**
   * Clear all records (useful in tests).
   */
  clear(): void {
    this.attempts.clear()
  }
}

export const defaultLoginRateLimiter = new LoginRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
})
