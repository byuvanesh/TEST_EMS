/**
 * DataSourceContext: Controls REAL vs DEMO telemetry source across the frontend.
 *
 * Requirements:
 * - REAL is the default.
 * - Explicit toggle between REAL and DEMO.
 * - Complete separation from canonical demo series (REAL mode never touches demo mock data).
 * - Visible badge when DEMO is active.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type DataSource = 'REAL' | 'DEMO'

interface DataSourceContextValue {
  dataSource: DataSource
  setDataSource: (source: DataSource) => void
  toggleDataSource: () => void
  isDemo: boolean
  isReal: boolean
}

const STORAGE_KEY = 'test_ems_data_source'

const DataSourceContext = createContext<DataSourceContextValue | null>(null)

export function DataSourceProvider({
  children,
  initialSource = 'REAL',
}: {
  children: ReactNode
  initialSource?: DataSource
}) {
  const [dataSource, setSourceState] = useState<DataSource>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved === 'REAL' || saved === 'DEMO') {
          return saved
        }
      } catch {
        // Storage access blocked or unavailable
      }
    }
    return initialSource
  })

  const setDataSource = useCallback((source: DataSource) => {
    setSourceState(source)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, source)
      } catch {
        // Ignore storage access errors
      }
    }
  }, [])

  const toggleDataSource = useCallback(() => {
    setDataSource(dataSource === 'REAL' ? 'DEMO' : 'REAL')
  }, [dataSource, setDataSource])

  const value = useMemo<DataSourceContextValue>(
    () => ({
      dataSource,
      setDataSource,
      toggleDataSource,
      isDemo: dataSource === 'DEMO',
      isReal: dataSource === 'REAL',
    }),
    [dataSource, setDataSource, toggleDataSource],
  )

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  )
}

export function useDataSource(): DataSourceContextValue {
  const ctx = useContext(DataSourceContext)
  if (!ctx) {
    throw new Error('useDataSource must be used within a DataSourceProvider')
  }
  return ctx
}
