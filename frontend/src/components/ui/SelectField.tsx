import { cn } from '@/lib/cn'

interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  id: string
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  className,
  disabled,
}: SelectFieldProps) {
  return (
    <label className={cn('flex min-w-[140px] flex-col gap-1', className)}>
      <span className="text-[11px] font-medium text-text-secondary">{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-[6px] border border-border bg-card px-2.5 text-xs text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
