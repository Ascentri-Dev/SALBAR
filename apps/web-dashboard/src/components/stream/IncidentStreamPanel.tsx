import { useState, useMemo } from 'react'
import { Radio, Search, Filter, AlertCircle, CheckCircle2, Clock, MapPin } from 'lucide-react'
import type { IncidentReport } from '../../types/cad'

export interface IncidentStreamPanelProps {
  incidents: IncidentReport[]
  selectedIncident: IncidentReport | null
  onSelectIncident: (incident: IncidentReport) => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

export function IncidentStreamPanel({
  incidents,
  selectedIncident,
  onSelectIncident,
  className = '',
}: IncidentStreamPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIncidents = useMemo(() => {
    if (!searchQuery.trim()) return incidents
    const q = searchQuery.toLowerCase().trim()
    return incidents.filter(
      (inc) =>
        inc.id.toLowerCase().includes(q) ||
        inc.location.name.toLowerCase().includes(q) ||
        inc.rawText.toLowerCase().includes(q) ||
        inc.detectedLanguage.toLowerCase().includes(q) ||
        inc.urgency.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q)
    )
  }, [incidents, searchQuery])

  return (
    <div
      className={`flex flex-col h-full bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] rounded-sm text-[var(--text-primary)] shadow-2xl overflow-hidden font-sans ${className}`.trim()}
    >
      {/* Panel Header */}
      <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0 bg-[var(--bg-surface-elevated)]/50">
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-[var(--accent-primary)] animate-pulse" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-sans">
            Live Dispatch Queue
          </h2>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
          <span className="font-bold text-[var(--text-primary)]">{filteredIncidents.length}</span>
          <span className="text-[10px] text-[var(--text-muted)]">/ {incidents.length} active</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/40 shrink-0">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports, location, dialect..."
            className="w-full pl-8 pr-3 py-1.5 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-sans placeholder:text-[var(--text-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>
      </div>

      {/* Incident List Stream */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredIncidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-muted)] font-sans">
            <Filter size={20} className="mb-2 opacity-50" />
            No reports matching your criteria.
          </div>
        ) : (
          filteredIncidents.map((inc) => {
            const isSelected = selectedIncident?.id === inc.id
            const isCritical = inc.urgency === 'CRITICAL' && inc.status !== 'RESOLVED'
            const isHigh = inc.urgency === 'HIGH' && inc.status !== 'RESOLVED'
            const isResolved = inc.status === 'RESOLVED'
            const isDispatched = inc.status === 'DISPATCHED'

            let statusBorderColor = 'border-l-blue-500'
            let urgencyBadgeClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30'

            if (isResolved) {
              statusBorderColor = 'border-l-emerald-500'
              urgencyBadgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            } else if (isCritical) {
              statusBorderColor = 'border-l-red-500'
              urgencyBadgeClass = 'bg-red-500/15 text-red-400 border-red-500/30'
            } else if (isHigh) {
              statusBorderColor = 'border-l-orange-500'
              urgencyBadgeClass = 'bg-orange-500/15 text-orange-400 border-orange-500/30'
            } else if (inc.urgency === 'MODERATE') {
              statusBorderColor = 'border-l-amber-500'
              urgencyBadgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }

            return (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`p-2.5 rounded-sm border border-l-4 ${statusBorderColor} transition-all cursor-pointer select-none font-sans ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-elevated)] shadow-lg ring-1 ring-[var(--accent-primary)]/50'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {inc.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-subtle)] uppercase">
                      {inc.detectedLanguage}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${urgencyBadgeClass}`}
                    >
                      {isResolved ? 'RESOLVED' : inc.urgency}
                    </span>
                  </div>
                </div>

                {/* Location with Pin Icon */}
                <div className="flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)] mb-1">
                  <MapPin size={11} className="text-[var(--accent-primary)] shrink-0" />
                  <span className="truncate">{inc.location.name}</span>
                </div>

                {/* Resident message snippet */}
                <p className="text-[11px] text-[var(--text-secondary)] italic line-clamp-2 mb-2 leading-relaxed font-sans">
                  "{inc.rawText}"
                </p>

                {/* Footer metadata */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]/40">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {inc.timestamp}
                  </span>
                  <span
                    className={`font-semibold uppercase tracking-wider flex items-center gap-1 ${
                      isResolved
                        ? 'text-emerald-400'
                        : isDispatched
                          ? 'text-blue-400'
                          : 'text-[var(--accent-primary)]'
                    }`}
                  >
                    {isResolved ? (
                      <>
                        <CheckCircle2 size={10} /> Done
                      </>
                    ) : isDispatched ? (
                      <>En Route ({inc.assignedUnitId})</>
                    ) : (
                      <>
                        <AlertCircle size={10} /> {inc.status.replace(/_/g, ' ')}
                      </>
                    )}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default IncidentStreamPanel
