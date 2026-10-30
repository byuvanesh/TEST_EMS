import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { getEnv } from './config/env.js'
import { AppError } from './utils/errors.js'
import { registerHealthRoutes } from './modules/health/routes.js'
import { registerSiteRoutes } from './modules/sites/routes.js'
import { registerLoadRoutes } from './modules/loads/routes.js'
import { registerOverviewRoutes } from './modules/overview/routes.js'
import { registerAnalyticsRoutes } from './modules/analytics/routes.js'

export async function buildApp() {
  const env = getEnv()

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    bodyLimit: env.BODY_LIMIT_BYTES,
    trustProxy: false,
  })

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'HEAD', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  })

  await registerHealthRoutes(app)
  await registerSiteRoutes(app)
  await registerLoadRoutes(app)
  await registerOverviewRoutes(app)
  await registerAnalyticsRoutes(app)

  // Explicitly ensure production ingest is NOT registered in Phase 2a.
  // (No POST /api/v1/ingest/telemetry route exists.)

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          details: err.details ?? undefined,
        },
      })
    }

    if ((err as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      })
    }

    app.log.error({ err }, 'Unhandled error')
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    })
  })

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    })
  })

  return app
}

export function listRegisteredRouteMethods(app: Awaited<ReturnType<typeof buildApp>>): string[] {
  return app.printRoutes().split('\n')
}
