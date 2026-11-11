// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { Header } from './Header'
import { AuthProvider } from '@/context/AuthContext'
import { AlarmProvider } from '@/context/AlarmStore'
import { BrandingProvider } from '@/context/BrandingContext'
import headerSource from './Header.tsx?raw'

type HeaderProps = Parameters<typeof Header>[0]

const mockProps: HeaderProps = {
  siteName: 'Test Facility',
  timezoneLabel: 'Asia/Kolkata',
  asOf: '2026-11-10T10:00:00Z',
  dataState: 'NO_DATA',
  activeAlarmCount: 0,
  loads: [
    { load_id: 'load-1', code: 'AC-01', name: 'AC-01', capacity_label: '5 TR', chart_color: '#3B82F6', data_state: 'NO_DATA', as_of: null, measurements: { active_power_kw: null, current_a: null, voltage_v: null, power_factor: null, frequency_hz: null, reactive_power_kvar: null, apparent_power_kva: null, active_import_kwh: null } },
    { load_id: 'load-2', code: 'AC-02', name: 'AC-02', capacity_label: '5 TR', chart_color: '#0D9488', data_state: 'NO_DATA', as_of: null, measurements: { active_power_kw: null, current_a: null, voltage_v: null, power_factor: null, frequency_hz: null, reactive_power_kvar: null, apparent_power_kva: null, active_import_kwh: null } },
    { load_id: 'load-3', code: 'Compressor-01', name: 'Compressor-01', capacity_label: 'Capacity TBD', chart_color: '#DB2777', data_state: 'NO_DATA', as_of: null, measurements: { active_power_kw: null, current_a: null, voltage_v: null, power_factor: null, frequency_hz: null, reactive_power_kvar: null, apparent_power_kva: null, active_import_kwh: null } },
  ],
  onMenuClick: vi.fn(),
  onRequestChangePassword: vi.fn(),
  changePasswordOpen: undefined,
  onChangePasswordOpenChange: vi.fn(),
}

function wrapWithProviders(element: ReactNode) {
  return (
    <AuthProvider>
      <BrandingProvider>
        <AlarmProvider>
          {element}
        </AlarmProvider>
      </BrandingProvider>
    </AuthProvider>
  )
}

describe('Header — search functionality', () => {
  it('renders search input in enabled state (not disabled)', () => {
    const html = renderToString(
      <MemoryRouter>
        {wrapWithProviders(<Header {...mockProps} />)}
      </MemoryRouter>,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const input = doc.querySelector('input[type="search"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input?.getAttribute('disabled')).toBeNull()
    expect(input?.placeholder).toContain('Search')
  })

  it('source implements search results dropdown', () => {
    expect(headerSource).toContain('filteredResults')
    expect(headerSource).toContain("type === 'load' ? 'Load' : 'Alarm'")
    expect(headerSource).toContain('No results for')
  })

  it('source implements result click navigation', () => {
    expect(headerSource).toContain('handleResultClick')
    expect(headerSource).toContain('navigate(route)')
  })

  it('source supports Escape key to close search', () => {
    expect(headerSource).toContain("e.key === 'Escape'")
    expect(headerSource).toContain("setSearchOpen(false)")
  })
})

describe('Header — notification panel', () => {
  it('renders bell button', () => {
    const html = renderToString(
      <MemoryRouter>
        {wrapWithProviders(<Header {...mockProps} loads={[]} />)}
      </MemoryRouter>,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const bell = doc.querySelector('button[title="Notifications"]')
    expect(bell).not.toBeNull()
  })

  it('source shows empty state when no notifications', () => {
    expect(headerSource).toContain('No notifications')
    expect(headerSource).toContain('All monitored parameters are within expected ranges')
  })

  it('source handles notification item click with loadId', () => {
    expect(headerSource).toContain('handleAlarmClick')
    expect(headerSource).toContain("alarm.loadId")
    expect(headerSource).toContain("navigate(`/loads/${alarm.loadId}`)")
  })

  it('source handles notification item click without loadId', () => {
    expect(headerSource).toContain("navigate('/alarms')")
  })
})

describe('Header — status badge', () => {
  it('renders StatusBadge with dataState prop', () => {
    expect(headerSource).toContain('<StatusBadge state={dataState} compact />')
  })

  it('StatusBadge is non-interactive (no onClick)', () => {
    const statusBadgeSection = headerSource.slice(
      headerSource.indexOf('<StatusBadge state={dataState}'),
      headerSource.indexOf('{/* Notification bell'),
    )
    expect(statusBadgeSection).not.toContain('onClick')
    expect(statusBadgeSection).not.toContain('onKeyDown')
  })
})

describe('Header — admin menu', () => {
  it('source renders Settings option for admin users', () => {
    expect(headerSource).toContain("user?.role === 'admin'")
    expect(headerSource).toContain("navigate('/settings')")
  })

  it('source renders Change password option', () => {
    expect(headerSource).toContain('Change password')
    expect(headerSource).toContain('openChangePassword')
  })

  it('source renders Sign out option with logout handler', () => {
    expect(headerSource).toContain('Sign out')
    expect(headerSource).toContain('handleSignOut')
  })

  it('source logout navigates to /login', () => {
    expect(headerSource).toContain("navigate('/login', { replace: true })")
  })
})

describe('Header — keyboard accessibility', () => {
  it('source supports Enter key handling via onKeyDown', () => {
    expect(headerSource).toContain('onKeyDown={handleSearchKeyDown}')
  })

  it('source Escape closes search dropdown', () => {
    expect(headerSource).toContain("setSearchQuery('')")
  })
})

describe('Header — no fake data', () => {
  it('does not contain hardcoded fake search results', () => {
    expect(headerSource).toContain('loadsProp')
    expect(headerSource).toContain('alarms')
    expect(headerSource).not.toContain('Fake Result')
    expect(headerSource).not.toContain('Demo Load')
  })

  it('does not create fake notifications', () => {
    expect(headerSource).toContain('.filter(')
    expect(headerSource).toContain('a.status')
    expect(headerSource).not.toContain('fake-notification')
    expect(headerSource).not.toContain('demo-notification')
  })
})
