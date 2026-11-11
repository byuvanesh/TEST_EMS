// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { MobileBottomNav } from './MobileBottomNav'
import * as AuthContextModule from '@/context/AuthContext'
import * as AlarmStoreModule from '@/context/AlarmStore'
import * as DataSourceContextModule from '@/context/DataSourceContext'

describe('MobileBottomNav Component', () => {
  function renderNav({
    initialEntry = '/',
    role = 'viewer' as 'admin' | 'viewer',
    openCount = 0,
    isDemo = true,
  } = {}) {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        username: role === 'admin' ? 'admin' : 'viewer',
        role,
        mustChangePassword: false,
      },
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      refreshMe: vi.fn(),
    } as any)

    vi.spyOn(AlarmStoreModule, 'useAlarmStore').mockReturnValue({
      alarms: [],
      openAlarms: [],
      openCount,
      criticalCount: 0,
      warningCount: 0,
      loading: false,
      error: null,
      acknowledgeAlarm: vi.fn(),
      refreshAlarms: vi.fn(),
    } as any)

    vi.spyOn(DataSourceContextModule, 'useDataSource').mockReturnValue({
      source: isDemo ? 'DEMO' : 'REAL',
      isDemo,
      isReal: !isDemo,
      setDataSource: vi.fn(),
    } as any)

    const html = renderToString(
      <MemoryRouter initialEntries={[initialEntry]}>
        <MobileBottomNav />
      </MemoryRouter>,
    )

    const parser = new DOMParser()
    return parser.parseFromString(html, 'text/html')
  }

  it('renders 5 navigation destinations for viewer role', () => {
    const doc = renderNav({ role: 'viewer' })
    const links = doc.querySelectorAll('a')
    expect(links.length).toBe(5)

    const labels = Array.from(links).map((l) => l.textContent?.trim())
    expect(labels.some((l) => l?.includes('Overview'))).toBe(true)
    expect(labels.some((l) => l?.includes('Energy'))).toBe(true)
    expect(labels.some((l) => l?.includes('Alarms'))).toBe(true)
    expect(labels.some((l) => l?.includes('Gateway'))).toBe(true)
    expect(labels.some((l) => l?.includes('System'))).toBe(true)
    expect(labels.some((l) => l?.includes('Settings'))).toBe(false)
  })

  it('renders 6 navigation destinations including Settings for admin role', () => {
    const doc = renderNav({ role: 'admin' })
    const links = doc.querySelectorAll('a')
    expect(links.length).toBe(6)

    const labels = Array.from(links).map((l) => l.textContent?.trim())
    expect(labels.some((l) => l?.includes('Settings'))).toBe(true)
    expect(labels.some((l) => l?.includes('Gateway'))).toBe(true)
  })

  it('highlights the active link with solid active state according to current route', () => {
    const doc = renderNav({ initialEntry: '/energy' })
    const energyLink = doc.querySelector('a[href="/energy"]')
    expect(energyLink).not.toBeNull()
    expect(energyLink?.className).toContain('text-accent')
    expect(energyLink?.className).toContain('bg-blue-50')
  })

  it('displays real alarm badge count when openCount > 0', () => {
    const doc = renderNav({ openCount: 3, isDemo: true })
    const alarmsLink = doc.querySelector('a[href="/alarms"]')
    expect(alarmsLink).not.toBeNull()
    expect(alarmsLink?.getAttribute('aria-label')).toContain('3 active alarms')
    expect(alarmsLink?.textContent).toContain('3')
  })

  it('does not display alarm badge when openCount is 0', () => {
    const doc = renderNav({ openCount: 0, isDemo: true })
    const alarmsLink = doc.querySelector('a[href="/alarms"]')
    expect(alarmsLink).not.toBeNull()
    expect(alarmsLink?.getAttribute('aria-label')).toBe('Alarms')
    expect(alarmsLink?.querySelector('.bg-critical')).toBeNull()
  })

  it('meets minimum touch target size, floating capsule styling, and accessibility requirements', () => {
    const doc = renderNav()
    const nav = doc.querySelector('nav')
    expect(nav).not.toBeNull()
    expect(nav?.getAttribute('role')).toBe('navigation')
    expect(nav?.getAttribute('aria-label')).toBe('Mobile bottom navigation')
    expect(nav?.className).toContain('md:hidden')
    expect(nav?.className).toContain('rounded-2xl')
    expect(nav?.className).toContain('bg-white')

    // Strictly verifies no glassmorphism
    expect(nav?.className).not.toContain('backdrop-blur')
    expect(nav?.className).not.toContain('backdrop-filter')

    const links = doc.querySelectorAll('a')
    for (const link of links) {
      expect(link.className).toContain('min-h-[48px]')
      expect(link.getAttribute('aria-label')).toBeTruthy()
    }
  })
})
