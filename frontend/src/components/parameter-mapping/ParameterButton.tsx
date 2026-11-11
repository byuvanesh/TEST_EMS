import { useState } from 'react'
import { cn } from '@/lib/cn'
import { MappingEditor } from '@/components/mapping-editor/MappingEditor'

interface ParameterButtonProps {
  slaveId: number | null
  meterId: string
  meterLabel: string
  parameterKey: string
  parameterLabel: string
  parameterUnit: string
  existingMapping: {
    source_keys: string[]
    decode: string
    word_order: string
    byte_order: string
    scale: number
    offset: number
    unit: string
    verification_status: 'UNVERIFIED' | 'VERIFIED'
    verified_by: string | null
    verified_at: string | null
    evidence_note: string | null
  } | null
  rawKeys: { key: string; value: unknown; type: string }[]
  onMappingConfirmed: () => void
}

export function ParameterButton({
  slaveId,
  meterId,
  meterLabel,
  parameterKey,
  parameterLabel,
  parameterUnit,
  existingMapping,
  rawKeys,
  onMappingConfirmed,
}: ParameterButtonProps) {
  const [editorOpen, setEditorOpen] = useState(false)

  const hasMapping = !!existingMapping
  const isVerified = existingMapping?.verification_status === 'VERIFIED'
  const sourceKey = existingMapping?.source_keys?.[0] ?? null

  const btnContent = hasMapping ? (
    <>
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Re-map
    </>
  ) : (
    <>
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 4v16M4 12h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Map
    </>
  )

  return (
    <div className="rounded-[8px] border border-border bg-card shadow-sm p-2.5 sm:p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-[10px] text-text truncate">
            {parameterLabel}
          </span>
          <span className="text-[9px] text-text-secondary">{parameterKey}</span>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase',
            hasMapping
              ? isVerified
                ? 'border border-success/30 bg-success/10 text-success'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-700'
              : 'border border-border bg-surface text-text-secondary',
          )}
        >
          {hasMapping
            ? isVerified
              ? 'CONFIRMED'
              : 'UNVERIFIED'
            : 'UNMAPPED'}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="rounded-[4px] border border-border bg-surface/50 px-2 py-1">
          <span className="text-[9px] font-medium text-text-secondary">Source</span>
          <div className="mt-0.5 font-mono text-[9px] text-text truncate">
            {sourceKey ?? '—'}
          </div>
        </div>
        <div className="rounded-[4px] border border-border bg-surface/50 px-2 py-1">
          <span className="text-[9px] font-medium text-text-secondary">Decode</span>
          <div className="mt-0.5 font-mono text-[9px] text-text">
            {existingMapping?.decode ?? '—'}
          </div>
        </div>
        <div className="rounded-[4px] border border-border bg-surface/50 px-2 py-1">
          <span className="text-[9px] font-medium text-text-secondary">Unit</span>
          <div className="mt-0.5 font-mono text-[9px] text-text">
            {existingMapping?.unit ?? parameterUnit}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="flex w-full items-center gap-1.5 rounded-[6px] border border-border bg-card px-2 py-1.5 text-[10px] font-medium text-text hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {btnContent}
        </button>
        {hasMapping && (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="flex w-full items-center gap-1.5 rounded-[6px] border border-border bg-card px-2 py-1.5 text-[10px] font-medium text-text hover:bg-surface"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit Mapping
          </button>
        )}
      </div>

      <MappingEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={onMappingConfirmed}
        meterId={meterId}
        meterLabel={meterLabel}
        slaveId={slaveId}
        parameterKey={parameterKey}
        parameterLabel={parameterLabel}
        parameterUnit={parameterUnit}
        rawKeys={rawKeys}
        existingMapping={
          existingMapping ? {
            source_keys: existingMapping.source_keys,
            decode: existingMapping.decode,
            word_order: existingMapping.word_order,
            byte_order: existingMapping.byte_order,
            scale: existingMapping.scale,
            offset: existingMapping.offset,
            unit: existingMapping.unit,
            verification_status: existingMapping.verification_status,
            verified_by: existingMapping.verified_by,
            verified_at: existingMapping.verified_at,
            evidence_note: existingMapping.evidence_note,
          } : null
        }
      />
    </div>
  )
}