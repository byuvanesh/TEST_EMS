import type { FastifyInstance } from 'fastify'
import { pingDatabase } from '../../database/pool.js'

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health/live', async () => ({
    status: 'ok',
    service: 'test-ems-backend',
    phase: '2a',
  }))

  app.get('/health/ready', async (_req, reply) => {
    try {
      await pingDatabase()
      return { status: 'ready', database: 'up' }
    } catch {
      return reply.code(503).send({
        status: 'not_ready',
        database: 'down',
      })
    }
  })
}
