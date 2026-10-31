import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Load .env.test for test runs (overrides .env), so tests use test_ems_test DB.
    // If .env.test does not exist, env.ts falls back to .env and the test-database
    // guard will throw (refuses to run against a database not ending in _test).
    env: {
      NODE_ENV: 'test',
    },
  },
})
