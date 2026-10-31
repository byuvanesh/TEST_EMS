import { useId, useState, type FormEvent } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'
import { useDemoAuth } from '@/context/DemoAuthStore'
import {
  changePasswordErrorMessage,
  passwordStrengthHint,
} from '@/lib/demoAuthLogic'

interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
}

export function ChangePasswordDialog({
  open,
  onClose,
}: ChangePasswordDialogProps) {
  const { changePassword } = useDemoAuth()
  const formId = useId()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  function resetAndClose() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
    setError(null)
    setSuccess(false)
    onClose()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const result = changePassword(currentPassword, newPassword, confirmPassword)
    if (!result.ok) {
      setSuccess(false)
      setError(changePasswordErrorMessage(result.reason))
      return
    }
    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-text/30"
        aria-label="Close change password dialog"
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="relative w-full max-w-md rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_16px_rgba(23,32,51,0.08)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id={`${formId}-title`}
              className="text-sm font-semibold text-text"
            >
              Change demo password
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Demo only — updates this browser session in memory. A page reload
              resets to the configured env password. Nothing is stored in
              localStorage or sessionStorage.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-[8px] p-1.5 text-text-secondary hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <PasswordField
            id={`${formId}-current`}
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />
          <PasswordField
            id={`${formId}-new`}
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            autoComplete="new-password"
            hint={
              newPassword
                ? passwordStrengthHint(newPassword)
                : 'Minimum 8 characters'
            }
          />
          <PasswordField
            id={`${formId}-confirm`}
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            autoComplete="new-password"
          />

          {error ? (
            <p className="text-xs text-critical" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-xs text-success" role="status">
              Demo password updated for this session. Reload restores the env
              value.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-[8px] border border-border bg-card px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface"
            >
              {success ? 'Close' : 'Cancel'}
            </button>
            {!success ? (
              <button
                type="submit"
                className="rounded-[8px] bg-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90"
              >
                Update password
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  autoComplete: string
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="h-10 w-full rounded-[8px] border border-border bg-surface py-2 pr-10 pl-3 text-sm text-text outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-text-secondary hover:bg-card"
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] text-text-secondary">{hint}</p>
      ) : null}
    </div>
  )
}
