import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, KeyRound, LogOut, Menu, Search, User } from 'lucide-react'
import type { DataQualityState } from '@/types'
import { formatTimestamp } from '@/lib/format'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useDemoAuth } from '@/context/DemoAuthStore'
import { ChangePasswordDialog } from '@/components/auth/ChangePasswordDialog'

interface HeaderProps {
  siteName: string
  timezoneLabel: string
  clockIso: string
  dataState: DataQualityState
  activeAlarmCount: number
  onMenuClick: () => void
  onRequestChangePassword?: () => void
  changePasswordOpen?: boolean
  onChangePasswordOpenChange?: (open: boolean) => void
}

export function Header({
  siteName,
  timezoneLabel,
  clockIso,
  dataState,
  activeAlarmCount,
  onMenuClick,
  onRequestChangePassword,
  changePasswordOpen: controlledOpen,
  onChangePasswordOpenChange,
}: HeaderProps) {
  const { state, signOut } = useDemoAuth()
  const navigate = useNavigate()
  const menuId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [localChangeOpen, setLocalChangeOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const changeOpen =
    controlledOpen !== undefined ? controlledOpen : localChangeOpen
  const setChangeOpen = (open: boolean) => {
    onChangePasswordOpenChange?.(open)
    if (controlledOpen === undefined) setLocalChangeOpen(open)
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  function handleSignOut() {
    setMenuOpen(false)
    signOut()
    navigate('/login', { replace: true })
  }

  function openChangePassword() {
    setMenuOpen(false)
    onRequestChangePassword?.()
    setChangeOpen(true)
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm md:px-6">
        <button
          type="button"
          className="inline-flex rounded-[8px] p-2 text-text-secondary hover:bg-surface md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{siteName}</p>
          <p className="truncate text-[11px] text-text-secondary">
            {formatTimestamp(clockIso)} · {timezoneLabel}
          </p>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              placeholder="Search loads, alarms…"
              disabled
              className="h-9 w-48 rounded-[8px] border border-border bg-surface pl-8 pr-3 text-xs text-text-secondary outline-none md:w-56"
              title="Search deferred — Phase 0 placeholder"
            />
          </div>
        </div>

        <StatusBadge state={dataState} />

        <button
          type="button"
          className="relative inline-flex rounded-[8px] p-2 text-text-secondary hover:bg-surface"
          aria-label={`${activeAlarmCount} open alarms`}
          title="Open alarms (active + acknowledged) — DEMO"
        >
          <Bell className="h-4 w-4" />
          {activeAlarmCount > 0 ? (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
              {activeAlarmCount}
            </span>
          ) : null}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-card"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <User className="h-3.5 w-3.5 text-text-secondary" />
            <span className="max-w-[7rem] truncate">
              {state.username ?? 'Demo user'}
            </span>
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 mt-1 w-48 rounded-[8px] border border-border bg-card py-1 shadow-[0_4px_16px_rgba(23,32,51,0.08)]"
            >
              <p className="border-b border-border px-3 py-2 text-[10px] text-text-secondary">
                Demo session · in-memory only
              </p>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-surface"
                onClick={openChangePassword}
              >
                <KeyRound className="h-3.5 w-3.5 text-text-secondary" />
                Change password
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-surface"
                onClick={handleSignOut}
              >
                <LogOut className="h-3.5 w-3.5 text-text-secondary" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <ChangePasswordDialog
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
      />
    </>
  )
}
