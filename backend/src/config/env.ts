import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// override:true so a parent-shell MYSQL_* from another project cannot shadow .env
loadDotenv({ path: path.join(backendRoot, '.env'), override: true })

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_DATABASE: z.string().min(1),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_MIGRATE_USER: z.string().min(1),
  MYSQL_MIGRATE_PASSWORD: z.string().min(1),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
  LOG_LEVEL: z.string().default('info'),
})

export type AppEnv = z.infer<typeof EnvSchema>

let cached: AppEnv | null = null

export function getEnv(): AppEnv {
  if (cached) return cached
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${details}`)
  }
  cached = parsed.data
  return cached
}

export function getBackendRoot(): string {
  return backendRoot
}

/** Reset cached env (tests). */
export function resetEnvCache(): void {
  cached = null
}
