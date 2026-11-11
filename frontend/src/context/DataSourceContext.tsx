/**
 * DataSourceContext: REAL DATA ONLY Energy Management System.
 *
 * Requirements:
 * - Application is strictly REAL-DATA ONLY.
 * - SIMULATED mode, simulated telemetry, and switching controls are completely disabled.
 * - Always reports dataSource = 'REAL', isReal = true, isDemo = false.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'

export type DataSource = 'REAL'

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
}: {
  children: ReactNode
  initialSource?: DataSource
}) {
  // Purge any legacy simulated selection from storage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Storage access blocked or unavailable
    }
  }

  const setDataSource = useCallback((_source: DataSource) => {
    // No-op: Application is strictly locked to REAL data
  }, [])

  const toggleDataSource = useCallback(() => {
    // No-op: Application is strictly locked to REAL data
  }, [])

  const value = useMemo<DataSourceContextValue>(
    () => ({
      dataSource: 'REAL',
      setDataSource,
      toggleDataSource,
      isDemo: false,
      isReal: true,
    }),
    [setDataSource, toggleDataSource],
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
