import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  Circle,
  KeyRound,
  LogOut,
  Search,
  Sliders,
  User,
} from 'lucide-react'
import type {
  AlarmItem,
  AlarmSeverity,
  DataQualityState,
} from '@/types'
import { formatTimeOnly, formatTimestamp } from '@/lib/format'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/context/AuthContext'
import { useBranding } from '@/context/BrandingContext'
import { useAlarmStore } from '@/context/AlarmStore'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'
import { type ApiOverviewLoad } from '@/api/client'
import { cn } from '@/lib/cn'

interface HeaderProps {
  siteName: string
  timezoneLabel: string
  clockIso?: string
  asOf?: string | null
  dataState: DataQualityState
  activeAlarmCount: number
  loads: ApiOverviewLoad[]
  onMenuClick: () => void
  onRequestChangePassword?: () => void
  changePasswordOpen?: boolean
  onChangePasswordOpenChange?: (open: boolean) => void
}

interface SearchResult {
  id: string
  label: string
  type: 'load' | 'alarm'
  route: string
}

export function Header({
  siteName,
  timezoneLabel,
  clockIso: _clockIso,
  asOf,
  dataState,
  loads: loadsProp,
  onRequestChangePassword,
  changePasswordOpen: controlledOpen,
  onChangePasswordOpenChange,
}: HeaderProps) {
  const { user, logout } = useAuth()
  const { companyName, logoUrl } = useBranding()
  const { alarms } = useAlarmStore()
  const navigate = useNavigate()
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [localChangeOpen, setLocalChangeOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  const changeOpen =
    controlledOpen !== undefined ? controlledOpen : localChangeOpen
  const setChangeOpen = (open: boolean) => {
    onChangePasswordOpenChange?.(open)
    if (controlledOpen === undefined) setLocalChangeOpen(open)
  }

  // Build searchable results from loads and alarms (real data only)
  const searchableResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []

    // Search loads by code or name
    for (const load of loadsProp) {
      const label = load.name || load.code || load.load_id
      results.push({
        id: load.load_id,
        label,
        type: 'load',
        route: `/loads/${load.load_id}`,
      })
    }

    // Search alarms by title or id
    for (const alarm of alarms) {
      results.push({
        id: alarm.id,
        label: alarm.title,
        type: 'alarm',
        route: `/alarms`,
      })
    }

    return results
  }, [loadsProp, alarms])

  // Filter results based on current query
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return searchableResults.filter(
      (r) =>
        r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
    )
  }, [searchQuery, searchableResults])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false)
      if (
        !notificationsRef.current?.contains(e.target as Node)
      ) {
        setNotificationsOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick)
    if (searchOpen) document.addEventListener('mousedown', onDocClick)
    if (notificationsOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen, searchOpen, notificationsOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  function openChangePassword() {
    setMenuOpen(false)
    onRequestChangePassword?.()
    setChangeOpen(true)
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchQuery(e.target.value)
    if (!e.target.value) {
      setSearchOpen(false)
    } else {
      setSearchOpen(true)
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setSearchOpen(false)
      setSearchQuery('')
      ;(e.target as HTMLInputElement).blur()
    }
  }

  function handleResultClick(route: string) {
    setSearchOpen(false)
    setSearchQuery('')
    navigate(route)
  }

  function handleAlarmClick(alarm: AlarmItem) {
    setNotificationsOpen(false)
    if (alarm.loadId) {
      navigate(`/loads/${alarm.loadId}`)
    } else {
      navigate('/alarms')
    }
  }

  const unreadCount = alarms.filter(
    (a) => a.status === 'active' || a.status === 'acknowledged',
  ).length

  const severityLabel = (s: AlarmSeverity) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-6 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-2 min-w-0 md:flex-1">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName}
              className="h-7 w-7 shrink-0 rounded-[6px] object-contain bg-white shadow-xs p-0.5 border border-border md:hidden"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-accent text-white shadow-xs md:hidden">
              <Activity className="h-3.5 w-3.5" />
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-tight text-text sm:text-sm md:font-semibold">
              <span className="md:hidden">{companyName}</span>
              <span className="hidden md:inline">{siteName}</span>
            </p>
            <p className="hidden truncate text-[11px] text-text-secondary md:block">
              {asOf ? (
                <>Data as of: {formatTimestamp(asOf)} · {timezoneLabel}</>
              ) : (
                <>Telemetry: No data yet · {timezoneLabel}</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search — real data only, no fake results */}
          <div className="relative hidden items-center gap-2 lg:flex" ref={searchRef}>
            <div className="relative w-full xl:w-52">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary"
              />
              <input
                type="search"
                placeholder="Search loads, alarms…"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setSearchOpen(Boolean(searchQuery.trim()))}
                className="h-8 w-full rounded-[6px] border border-border bg-surface pl-8 pr-3 text-xs text-text placeholder:text-text-secondary outline-none focus:border-accent transition-colors"
              />
            </div>

            {searchOpen && filteredResults.length > 0 && (
              <div className="absolute z-50 mt-1.5 w-full rounded-[8px] border border-border bg-card shadow-lg">
                {filteredResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleResultClick(result.route)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface transition-colors focus:outline-none focus:bg-surface focus:ring-0"
                  >
                    {result.type === 'load' ? (
                      <Circle className="h-3 w-3 text-text-secondary/50" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                    <span className="truncate min-w-0 text-text">{result.label}</span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                        result.type === 'load'
                          ? 'border-border bg-surface text-text-secondary/70'
                          : 'border-amber-100 bg-amber-50 text-amber-700',
                      )}
                    >
                      {result.type === 'load' ? 'Load' : 'Alarm'}
                    </span>
                    <ChevronRight className="h-3 w-3 text-text-secondary/40 ml-auto shrink-0" />
                  </button>
                ))}
                {filteredResults.length === 0 && searchQuery.trim() && (
                  <div className="px-3 py-2 text-xs text-text-secondary">
                    No results for “{searchQuery}”
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data state badge — non-interactive status indicator */}
          <StatusBadge state={dataState} compact />

          {/* Notification bell — opens panel with real alarms, empty state if none */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev)
                setSearchOpen(false)
                setMenuOpen(false)
              }}
              className="relative inline-flex rounded-[6px] p-1.5 sm:p-2 text-text-secondary hover:bg-surface hover:text-text transition-colors shrink-0"
              aria-label={`${unreadCount} unread notifications`}
              title="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="menu"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white ring-2 ring-card">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>

            {notificationsOpen && (
              <div
                className="absolute z-50 mt-1.5 w-[320px] rounded-[8px] border border-border bg-card shadow-lg flex flex-col"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider">
                    Notifications
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/alarms')}
                    className="text-[10px] text-accent hover:text-accent/80 underline underline-offset-2"
                  >
                    View all
                  </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {unreadCount === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <Circle className="h-8 w-8 text-border/30 mx-auto mb-2" />
                      <p className="text-xs font-medium text-text">No notifications</p>
                      <p className="mt-0.5 text-[10px] text-text-secondary">
                        All monitored parameters are within expected ranges.
                      </p>
                    </div>
                  ) : (
                    <>
                      {alarms
                        .filter(
                          (a) =>
                            a.status === 'active' || a.status === 'acknowledged',
                        )
                        .slice(0, 10)
                        .map((alarm) => (
                          <button
                            key={alarm.id}
                            type="button"
                            role="menuitem"
                            onClick={() => handleAlarmClick(alarm)}
                            className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-surface transition-colors focus:outline-none focus:bg-focus"
                          >
                            <div className="flex items-center gap-1">
                              {alarm.severity === 'critical' ? (
                                <AlertTriangle className="h-3 w-3 text-critical shrink-0" />
                              ) : alarm.severity === 'warning' ? (
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                              ) : (
                                <Circle className="h-3 w-3 text-blue-500 shrink-0" />
                              )}
                              <span className="ml-0.5 text-[10px] font-medium uppercase tracking-wider">
                                {severityLabel(alarm.severity)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-text truncate">
                                {alarm.title}
                              </p>
                              <p className="mt-0.5 text-[10px] text-text-secondary">
                                {alarm.loadId ?? 'Site'}
                              </p>
                            </div>
                            <span className="text-[10px] text-text-secondary">
                              {formatTimeOnly(alarm.raisedAt)}
                            </span>
                            <ChevronRight className="h-3 w-3 text-text-secondary/40 shrink-0" />
                          </button>
                        ))}
                      {alarms.length > 10 && (
                        <div className="px-3 py-2 text-center border-t border-border/50">
                          <button
                            type="button"
                            onClick={() => navigate('/alarms')}
                            className="w-full text-xs text-accent hover:text-accent/80"
                          >
                            Show all {alarms.length} notifications
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-card p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-text hover:bg-surface shadow-xs transition-colors shrink-0"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => {
                setMenuOpen((v) => !v)
                setSearchOpen(false)
                setNotificationsOpen(false)
              }}
            >
              <User className="h-3.5 w-3.5 text-text-secondary" />
              <span className="hidden sm:inline max-w-[5.5rem] truncate sm:max-w-[7rem]">
                {user?.username ?? 'User'}
              </span>
            </button>
            {menuOpen ? (
              <div
                id={menuId}
                role="menu"
                className="absolute right-0 mt-1.5 w-52 rounded-[10px] border border-border bg-card py-1.5 shadow-popover z-50"
              >
                <div className="border-b border-border px-3 py-2 text-[10px] text-text-secondary">
                  <p className="font-semibold text-text">{user?.username ?? 'User'}</p>
                  <p className="capitalize">Role: {user?.role ?? 'operator'}</p>
                </div>
                {user?.role === 'admin' ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-surface transition-colors"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/settings')
                    }}
                  >
                    <Sliders className="h-3.5 w-3.5 text-text-secondary" />
                    Settings
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-surface transition-colors"
                  onClick={openChangePassword}
                >
                  <KeyRound className="h-3.5 w-3.5 text-text-secondary" />
                  Change password
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-surface transition-colors"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-3.5 w-3.5 text-text-secondary" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <ChangePasswordDialog
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
      />
    </>
  )
}
