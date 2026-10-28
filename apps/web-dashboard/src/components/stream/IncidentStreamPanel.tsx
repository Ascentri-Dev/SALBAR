import { useState } from 'react'
import { Radio, Search, Filter } from 'lucide-react'
import type { IncidentReport } from '../../types/cad'

export interface IncidentStreamPanelProps {
  incidents: IncidentReport[]
  selectedIncident: IncidentReport | null
  onSelectIncident: (incident: IncidentReport) => void
  isMinimized: boolean
  onToggleMinimize: () => void
}

export function IncidentStreamPanel({
  incidents,
  selectedIncident,
  onSelectIncident,
}: IncidentStreamPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIncidents = incidents.filter((inc) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      inc.id.toLowerCase().includes(q) ||
      inc.location.name.toLowerCase().includes(q) ||
      inc.rawText.toLowerCase().includes(q) ||
      inc.detectedLanguage.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]/95 backdrop-blur-xl border-l border-[var(--border-subtle)] text-[var(--text-primary)] shadow-2xl">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-[var(--accent-primary)] animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Live Triage CAD Feed
          </h2>
        </div>
        <span className="font-mono text-[11px] text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
          {incidents.length} Reports
        </span>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/50 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incident, location, or dialect..."
            className="w-full pl-8 pr-3 py-1.5 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs placeholder:text-[var(--text-muted)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>
      </div>

      {/* Incident List Stream */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredIncidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-muted)]">
            <Filter size={20} className="mb-2 opacity-50" />
            No reports matching the active query.
          </div>
        ) : (
          filteredIncidents.map((inc) => {
            const isSelected = selectedIncident?.id === inc.id
            const isCritical = inc.urgency === 'CRITICAL'
            const isHigh = inc.urgency === 'HIGH'

            return (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`p-3 rounded-sm border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-elevated)] shadow-md ring-1 ring-[var(--accent-primary)]/50'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {inc.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-subtle)] uppercase">
                      {inc.detectedLanguage}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isCritical
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : isHigh
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      }`}
                    >
                      {inc.urgency}
                    </span>
                  </div>
                </div>

                {/* Location */}
                <div className="text-xs font-semibold text-[var(--text-primary)] mb-1 truncate">
                  {inc.location.name}
                </div>

                {/* Raw text */}
                <p className="text-[11px] text-[var(--text-secondary)] italic line-clamp-2 mb-2 leading-relaxed">
                  "{inc.rawText}"
                </p>

                {/* Footer metadata */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]/50">
                  <span>{inc.timestamp}</span>
                  <span className="text-[var(--accent-primary)] font-semibold uppercase">
                    {inc.status.replace('_', ' ')}
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
