import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAppPool } from '../../database/pool.js'
import { getEnv } from '../../config/env.js'
import { badRequest } from '../../utils/errors.js'
import { login, logout, changePassword } from './service.js'
import { authenticate } from './middleware.js'
import { deriveCsrfToken } from './crypto.js'

const LoginBodySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
})

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const env = getEnv()

  // --------------------------------------------------------------------------
  // POST /api/auth/login
  // --------------------------------------------------------------------------
  app.post('/api/auth/login', async (req, reply) => {
    const parseResult = LoginBodySchema.safeParse(req.body)
    if (!parseResult.success) {
      throw badRequest('VALIDATION_ERROR', 'Invalid login request body', parseResult.error.format())
    }

    const { username, password } = parseResult.data
    const pool = getAppPool()
    const clientIp = req.ip || '127.0.0.1'

    const result = await login(pool, env, username, password, clientIp)

    // Set SameSite=Lax, HttpOnly session cookie
    reply.setCookie('ems_session', result.rawToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
    })

    return reply.status(200).send({
      user: result.user,
      csrfToken: result.csrfToken,
    })
  })

  // --------------------------------------------------------------------------
  // POST /api/auth/logout
  // --------------------------------------------------------------------------
  app.post(
    '/api/auth/logout',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const pool = getAppPool()
      if (req.rawToken) {
        await logout(pool, req.rawToken)
      }
      reply.clearCookie('ems_session', { path: '/' })
      return reply.status(200).send({ ok: true })
    },
  )

  // --------------------------------------------------------------------------
  // GET /api/auth/me
  // --------------------------------------------------------------------------
  app.get(
    '/api/auth/me',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const csrfToken = req.rawToken
        ? deriveCsrfToken(req.rawToken, env.SESSION_SECRET)
        : ''

      return reply.status(200).send({
        user: req.user,
        csrfToken,
      })
    },
  )

  // --------------------------------------------------------------------------
  // POST /api/auth/change-password
  // --------------------------------------------------------------------------
  app.post(
    '/api/auth/change-password',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const parseResult = ChangePasswordBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        throw badRequest(
          'VALIDATION_ERROR',
          'Invalid change-password request body',
          parseResult.error.format(),
        )
      }

      const { currentPassword, newPassword } = parseResult.data
      const pool = getAppPool()

      await changePassword(pool, req.user!.id, currentPassword, newPassword)

      // Update user state on the request
      if (req.user) {
        req.user.mustChangePassword = false
      }

      return reply.status(200).send({
        ok: true,
        mustChangePassword: false,
      })
    },
  )
}
