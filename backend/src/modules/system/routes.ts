import type { FastifyInstance } from 'fastify'
import { authenticate } from '../auth/middleware.js'

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  /**
   * PUT /api/system/mapping
   * State-changing route for configuring meter mappings.
   * STRICTLY requires authentication, password change completion, and CSRF token.
   */
  app.put(
    '/api/system/mapping',
    { preHandler: [authenticate] },
    async (_req, reply) => {
      // Step 3 stub — verifies authentication & CSRF enforcement.
      // Full mapping logic is implemented in Step 4.
      return reply.status(200).send({
        ok: true,
        message: 'System mapping endpoint reached with valid authentication and CSRF verification',
      })
    },
  )
}
