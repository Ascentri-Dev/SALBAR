import { useState } from 'react'
import { Send, X, Bot, Cpu, CheckCircle2, AlertCircle } from 'lucide-react'
import type { IncidentReport, FieldResponder } from '../../types/cad'
import { useTheme } from '../../context'

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
  const { theme } = useTheme()
  const isLight = theme === 'light'

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
      className={`flex flex-col h-full rounded-3xl border shadow-2xl overflow-hidden font-sans select-none transition-colors duration-300 ${
        isLight
          ? 'bg-white border-slate-300 shadow-slate-300/40 text-slate-900'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] shadow-black/50 text-slate-100'
      } ${className}`.trim()}
    >
      {/* Header */}
      <div
        className={`p-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
          isLight
            ? 'bg-slate-50 border-slate-200'
            : 'bg-[var(--bg-surface-elevated)]/60 border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[var(--accent-primary)]" />
          <div>
            <h3
              className={`text-xs font-black uppercase tracking-wider font-heading ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              Dispatch Authorization
            </h3>
            <span
              className={`font-mono text-[10px] ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {incident.id} &bull; {incident.location.name}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Dispatch Panel"
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isLight
              ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              : 'hover:bg-[var(--bg-surface-elevated)] text-slate-400 hover:text-white'
          }`}
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-3.5 space-y-3 overflow-y-auto flex-1 font-sans">
        {/* Civilian Input */}
        <div
          className={`p-3 rounded-2xl border space-y-1 ${
            isLight
              ? 'bg-slate-50/70 border-slate-200'
              : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
          }`}
        >
          <div
            className={`flex justify-between items-center text-[10px] font-mono uppercase ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            <span>Resident Message ({incident.detectedLanguage})</span>
            <span>Source: {incident.source.replace(/_/g, ' ')}</span>
          </div>
          <p
            className={`text-xs italic font-normal leading-relaxed ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            "{incident.rawText}"
          </p>
        </div>

        {/* AI Briefing Context */}
        <div
          className={`p-3 rounded-2xl border space-y-1 ${
            isLight
              ? 'bg-slate-50/70 border-slate-200'
              : 'bg-[var(--bg-surface-elevated)]/40 border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent-primary)] uppercase tracking-wider font-heading">
            <AlertCircle size={13} />
            <span>Triage Context</span>
          </div>
          <p
            className={`text-xs leading-relaxed ${
              isLight ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            {incident.aiBriefing}
          </p>
        </div>

        {/* OR-Tools Optimization Recommendation */}
        <div
          className={`p-3 rounded-2xl border space-y-2 ${
            isLight
              ? 'bg-orange-50/40 border-orange-200'
              : 'bg-orange-500/5 border-orange-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent-primary)] uppercase tracking-wider font-heading">
              <Cpu size={13} />
              <span>OR-Tools Allocation</span>
            </div>
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
              Optimal Match
            </span>
          </div>

          <div
            className={`grid grid-cols-2 gap-2 text-[11px] font-mono ${
              isLight ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            <div>
              Unit:{' '}
              <strong className={isLight ? 'text-slate-900' : 'text-slate-100'}>
                {defaultRecommendedUnit.name}
              </strong>
            </div>
            <div>
              Fatigue:{' '}
              <strong className={isLight ? 'text-slate-900' : 'text-slate-100'}>
                {activeSelectedUnit.fatigueScore}%
              </strong>
            </div>
            <div>
              Battery:{' '}
              <strong className={isLight ? 'text-slate-900' : 'text-slate-100'}>
                {activeSelectedUnit.batteryPercent}%
              </strong>
            </div>
            <div>
              Est. Transit:{' '}
              <strong className="text-emerald-500 dark:text-emerald-400">~4.5m</strong>
            </div>
          </div>
        </div>

        {/* Unit Assignment Selector */}
        <div className="space-y-1.5">
          <label
            className={`text-[10px] font-bold uppercase tracking-wider font-heading ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            Assigned Field Terminal (LoRa Node)
          </label>
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            disabled={isDispatchedSuccess}
            className={`w-full px-4 py-2 rounded-full border text-xs font-mono transition-colors focus:outline-none focus:border-[var(--accent-primary)] ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900'
                : 'bg-[var(--bg-base)] border-[var(--border-subtle)] text-slate-100'
            }`}
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
          <div className="p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-sans font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={16} /> Dispatched to {selectedUnitId} via LoRa Mesh
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs hover:underline cursor-pointer"
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
              className="flex-1 py-2.5 px-4 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
            >
              <Send size={13} />
              {isSubmitting ? 'Transmitting...' : 'Authorize Dispatch'}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting}
              className={`py-2.5 px-4 rounded-full border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                isLight
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-[var(--border-subtle)] text-slate-300 hover:bg-[var(--bg-surface-elevated)]'
              }`}
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
