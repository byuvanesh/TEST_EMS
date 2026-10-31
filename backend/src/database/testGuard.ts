/**
 * Test Database Guard (Housekeeping H2)
 * Ensures that automated tests NEVER execute against a development or production database.
 * Tests must refuse to run unless the database name strictly ends with '_test'.
 */

export function assertTestDatabaseGuard(
  databaseName: string,
  options: { isTest?: boolean; allowUnsafeOverride?: boolean } = {},
): void {
  const isTest =
    options.isTest ??
    (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true')

  if (!isTest) return

  const allowOverride =
    options.allowUnsafeOverride ??
    (process.env.ALLOW_UNSAFE_DEV_DB_TESTING === 'true')

  if (allowOverride) {
    return
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `TEST DATABASE GUARD: Refusing to run tests against database '${databaseName}'. ` +
      `Test database name must strictly end with '_test' (e.g. 'test_ems_test') to protect the development database. ` +
      `Please configure MYSQL_DATABASE=test_ems_test or grant access to a test database ending in '_test'.`,
    )
  }
}
