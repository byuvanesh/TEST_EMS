import { describe, expect, it } from 'vitest'
import { assertTestDatabaseGuard } from '../../src/database/testGuard.js'

describe('Housekeeping H2: Test Database Guard', () => {
  it('refuses to allow test execution against databases not ending with _test', () => {
    // Non-test database names must throw
    expect(() =>
      assertTestDatabaseGuard('test_ems', { isTest: true, allowUnsafeOverride: false }),
    ).toThrow(/TEST DATABASE GUARD: Refusing to run tests against database 'test_ems'/)

    expect(() =>
      assertTestDatabaseGuard('production_db', { isTest: true, allowUnsafeOverride: false }),
    ).toThrow(/TEST DATABASE GUARD: Refusing to run tests against database 'production_db'/)

    expect(() =>
      assertTestDatabaseGuard('test_ems_dev', { isTest: true, allowUnsafeOverride: false }),
    ).toThrow(/TEST DATABASE GUARD: Refusing to run tests against database 'test_ems_dev'/)
  })

  it('permits execution when database name strictly ends with _test', () => {
    expect(() =>
      assertTestDatabaseGuard('test_ems_test', { isTest: true, allowUnsafeOverride: false }),
    ).not.toThrow()

    expect(() =>
      assertTestDatabaseGuard('app_qa_test', { isTest: true, allowUnsafeOverride: false }),
    ).not.toThrow()
  })

  it('does not enforce guard outside of test environment', () => {
    expect(() =>
      assertTestDatabaseGuard('test_ems', { isTest: false, allowUnsafeOverride: false }),
    ).not.toThrow()
  })
})
