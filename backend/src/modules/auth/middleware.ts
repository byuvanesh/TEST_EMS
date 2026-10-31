import type { FastifyReply, FastifyRequest } from 'fastify'
import { getAppPool } from '../../database/pool.js'
import { getEnv } from '../../config/env.js'
import { AppError } from '../../utils/errors.js'
import { validateSession, type AuthUser } from './service.js'
import { verifyCsrfToken } from './crypto.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
    rawToken?: string
  }
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

/**
 * Fastify preHandler hook to enforce authentication, session validity,
 * forced password change restrictions, and CSRF protection on state-changing requests.
 */
export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const env = getEnv()
  const pool = getAppPool()

  // 1. Extract raw session token from cookie or Authorization header
  let rawToken: string | undefined

  if (req.cookies && req.cookies['ems_session']) {
    rawToken = req.cookies['ems_session']
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    rawToken = req.headers.authorization.slice(7).trim()
  }

  if (!rawToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required')
  }

  // 2. Validate session against database (hashed lookup per H7)
  const session = await validateSession(pool, rawToken)
  if (!session) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Session has expired or is invalid')
  }

  req.user = session.user
  req.rawToken = rawToken

  // 3. Forced password change check: if mustChangePassword is true, user can only access
  // /api/auth/change-password, /api/auth/me, and /api/auth/logout.
  const path = req.url.split('?')[0]
  const isAllowedPath =
    path === '/api/auth/change-password' ||
    path === '/api/auth/me' ||
    path === '/api/auth/logout'

  if (session.user.mustChangePassword && !isAllowedPath) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'Password change required before accessing this resource',
    )
  }

  // 4. CSRF protection on state-changing requests
  if (STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    const providedCsrfToken = req.headers['x-csrf-token'] as string | undefined

    if (!providedCsrfToken || !verifyCsrfToken(rawToken, providedCsrfToken, env.SESSION_SECRET)) {
      throw new AppError(403, 'CSRF_REJECTED', 'Missing or invalid CSRF token')
    }
  }
}
