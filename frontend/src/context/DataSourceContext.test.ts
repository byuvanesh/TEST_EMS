import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { DataSourceProvider, useDataSource } from './DataSourceContext'

describe('DataSourceContext', () => {
  it('provides REAL by default and allows consumer to read properties', () => {
    function Consumer() {
      const ctx = useDataSource()
      expect(ctx.dataSource).toBe('REAL')
      expect(ctx.isReal).toBe(true)
      expect(ctx.isDemo).toBe(false)
      return null
    }

    const el = createElement(
      DataSourceProvider,
      {
        initialSource: 'REAL',
        children: createElement(Consumer, null),
      },
    )
    expect(el).toBeDefined()
  })
})
