import { useId, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
function passwordStrength(password: string): 'too-short' | 'weak' | 'fair' | 'strong' {
  if (password.length < 8) return 'too-short'
  let score = 0
  if (password.length >= 10) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score >= 3) return 'strong'
  if (score >= 2) return 'fair'
  return 'weak'
}

function passwordStrengthHint(password: string): string {
  switch (passwordStrength(password)) {
    case 'too-short':
      return 'At least 8 characters required'
    case 'weak':
      return 'Weak — add mixed case, numbers, or symbols'
    case 'fair':
      return 'Fair — consider adding numbers or symbols'
    case 'strong':
      return 'Strong password'
  }
}

interface ChangePasswordDialogProps {
  open: boolean
  forced?: boolean
  onClose?: () => void
  onSuccess?: () => void
}

export function ChangePasswordDialog({
  open,
  forced = false,
  onClose,
  onSuccess,
}: ChangePasswordDialogProps) {
  const { changePassword } = useAuth()
  const formId = useId()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  function resetAndClose() {
    if (forced && !success) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrent(false)
    setShowNew(false)
    setError(null)
    setSuccess(false)
    onClose?.()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!currentPassword) {
      setError('Current password is required.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from current password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await changePassword(currentPassword, newPassword)
      if (!res.ok) {
        setError(res.error || 'Failed to update password.')
        return
      }
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onSuccess?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-text/40 backdrop-blur-xs"
        aria-label="Close change password dialog"
        disabled={forced && !success}
        onClick={resetAndClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="relative w-full max-w-md rounded-[12px] border border-border bg-card p-6 shadow-[0_8px_32px_rgba(23,32,51,0.16)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-accent/10 text-accent">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2
                id={`${formId}-title`}
                className="text-base font-semibold text-text"
              >
                {forced ? 'Password Change Required' : 'Change Password'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                {forced
                  ? 'Your account requires an immediate password change before proceeding.'
                  : 'Update your account password. Requires your current password.'}
              </p>
            </div>
          </div>
          {!forced ? (
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-[8px] p-1.5 text-text-secondary hover:bg-surface"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <PasswordField
            id={`${formId}-current`}
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
            disabled={submitting || success}
          />
          <PasswordField
            id={`${formId}-new`}
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            autoComplete="new-password"
            disabled={submitting || success}
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
            disabled={submitting || success}
          />

          {error ? (
            <p
              className="rounded-[8px] border border-critical/20 bg-critical/5 px-3 py-2 text-xs text-critical"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              className="rounded-[8px] border border-success/20 bg-success/5 px-3 py-2 text-xs text-success"
              role="status"
            >
              Password changed successfully! You can now proceed to the dashboard.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            {!forced && !success ? (
              <button
                type="button"
                onClick={resetAndClose}
                disabled={submitting}
                className="rounded-[8px] border border-border bg-card px-3.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface"
              >
                Cancel
              </button>
            ) : null}
            {success ? (
              <button
                type="button"
                onClick={() => {
                  resetAndClose()
                  onSuccess?.()
                }}
                className="rounded-[8px] bg-accent px-4 py-2 text-xs font-medium text-white hover:opacity-90"
              >
                Continue to Dashboard
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-[8px] bg-accent px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            )}
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
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  autoComplete: string
  hint?: string
  disabled?: boolean
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
          disabled={disabled}
          className="h-10 w-full rounded-[8px] border border-border bg-surface py-2 pr-10 pl-3 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onToggleShow}
          disabled={disabled}
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
