import { useState } from 'react'
import { Send, X, Bot, Cpu, CheckCircle2, AlertCircle } from 'lucide-react'
import type { IncidentReport, FieldResponder } from '../../types/cad'

export interface HITLDispatchDrawerProps {
  incident: IncidentReport | null
  responders: FieldResponder[]
  onApproveDispatch: (incidentId: string, unitId: string) => void
  onRejectProposal: (incidentId: string) => void
  onClose: () => void
  className?: string
}

export function HITLDispatchDrawer({
  incident,
  responders,
  onApproveDispatch,
  onRejectProposal,
  onClose,
  className = '',
}: HITLDispatchDrawerProps) {
  const defaultRecommendedUnit =
    responders.find((r) => r.id === incident?.recommendedUnitId) || responders[0]

  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    defaultRecommendedUnit ? defaultRecommendedUnit.id : ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDispatchedSuccess, setIsDispatchedSuccess] = useState(
    incident ? incident.status === 'DISPATCHED' : false
  )

  if (!incident) return null

  const activeSelectedUnit =
    responders.find((r) => r.id === selectedUnitId) || defaultRecommendedUnit

  const handleApprove = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      onApproveDispatch(incident.id, selectedUnitId)
      setIsSubmitting(false)
      setIsDispatchedSuccess(true)
    }, 500)
  }

  const handleReject = () => {
    onRejectProposal(incident.id)
    onClose()
  }

  return (
    <div
      className={`flex flex-col h-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-sm shadow-2xl overflow-hidden font-sans ${className}`.trim()}
    >
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 bg-[var(--bg-surface-elevated)]/60 shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[var(--accent-primary)]" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-sans">
              Dispatch Authorization
            </h3>
            <span className="font-mono text-[10px] text-[var(--text-secondary)]">
              {incident.id} &bull; {incident.location.name}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Dispatch Panel"
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)] transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 font-sans">
        {/* Civilian Input */}
        <div className="p-2.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)]/40 space-y-1">
          <div className="flex justify-between items-center text-[10px] font-mono text-[var(--text-muted)] uppercase">
            <span>Resident Message ({incident.detectedLanguage})</span>
            <span>Source: {incident.source.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-xs italic text-[var(--text-primary)] font-normal leading-relaxed">
            "{incident.rawText}"
          </p>
        </div>

        {/* AI Briefing Context */}
        <div className="p-2.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/40 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider font-sans">
            <AlertCircle size={13} />
            <span>Triage Context</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {incident.aiBriefing}
          </p>
        </div>

        {/* OR-Tools Optimization Recommendation */}
        <div className="p-2.5 rounded-sm border border-orange-500/30 bg-orange-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent-primary)] uppercase tracking-wider font-sans">
              <Cpu size={13} />
              <span>OR-Tools Allocation</span>
            </div>
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]">
              Optimal Match
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--text-secondary)]">
            <div>
              Unit: <strong className="text-[var(--text-primary)]">{defaultRecommendedUnit.name}</strong>
            </div>
            <div>
              Fatigue: <strong className="text-[var(--text-primary)]">{activeSelectedUnit.fatigueScore}%</strong>
            </div>
            <div>
              Battery: <strong className="text-[var(--text-primary)]">{activeSelectedUnit.batteryPercent}%</strong>
            </div>
            <div>
              Est. Transit: <strong className="text-[var(--color-emergency-success)]">~4.5m</strong>
            </div>
          </div>
        </div>

        {/* Unit Assignment Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] font-sans">
            Assigned Field Terminal (LoRa Node)
          </label>
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            disabled={isDispatchedSuccess}
            className="w-full px-2.5 py-1.5 rounded-sm bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-primary)]"
          >
            {responders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} - {r.name} ({r.role}) - Fatigue: {r.fatigueScore}%
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        {isDispatchedSuccess ? (
          <div className="p-2.5 rounded-sm border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-400 font-sans font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Dispatched to {selectedUnitId} via LoRa Mesh
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[var(--text-primary)] hover:underline cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1 font-sans">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isSubmitting}
              className="flex-1 py-2 px-3 rounded-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Send size={13} />
              {isSubmitting ? 'Transmitting...' : 'Authorize Dispatch'}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting}
              className="py-2 px-3 rounded-sm border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default HITLDispatchDrawer
