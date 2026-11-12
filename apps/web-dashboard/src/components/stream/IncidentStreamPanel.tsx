import { useState, useMemo } from 'react'
import { Search, Filter, AlertCircle, CheckCircle2, Clock, MapPin, ChevronRight } from 'lucide-react'
import type { IncidentReport } from '../../types/cad'
import { useTheme } from '../../context'

export interface IncidentStreamPanelProps {
  incidents: IncidentReport[]
  selectedIncident: IncidentReport | null
  onSelectIncident: (incident: IncidentReport) => void
  onClose?: () => void
  className?: string
}

export function IncidentStreamPanel({
  incidents,
  selectedIncident,
  onSelectIncident,
  onClose,
  className = '',
}: IncidentStreamPanelProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
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
      className={`flex flex-col h-full rounded-3xl border shadow-2xl overflow-hidden font-sans select-none transition-colors duration-300 ${
        isLight
          ? 'bg-white border-slate-300 shadow-slate-300/40 text-slate-900'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] shadow-black/50 text-slate-100'
      } ${className}`.trim()}
    >
      {/* Panel Header with Circular Collapse Button */}
      <div
        className={`p-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/60 border-[var(--border-subtle)]'
        }`}
      >
        <h2
          className={`text-xs font-black uppercase tracking-wider font-heading ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          }`}
        >
          Live Dispatch Queue
        </h2>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="font-bold px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] font-mono text-[11px]">
            {filteredIncidents.length} / {incidents.length}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isLight
                  ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                  : 'hover:bg-[var(--bg-surface-elevated)] text-slate-400 hover:text-white'
              }`}
              title="Collapse Queue"
              aria-label="Collapse Queue"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search Input: Circular Pill */}
      <div
        className={`p-2.5 border-b shrink-0 ${
          isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
        }`}
      >
        <div className="relative">
          <Search
            size={14}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isLight ? 'text-slate-400' : 'text-slate-400'
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports, location, dialect..."
            className={`w-full pl-9 pr-4 py-2 rounded-full border text-xs font-sans transition-colors focus:outline-none focus:border-[var(--accent-primary)] ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-slate-100 placeholder:text-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Incident List Stream */}
      <div className="flex-1 overflow-y-auto salbar-scrollbar p-3 space-y-2.5">
        {filteredIncidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-muted)] font-sans">
            <Filter size={22} className="mb-2 opacity-50 text-[var(--accent-primary)]" />
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
            let urgencyBadgeClass = 'bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/30'

            if (isResolved) {
              statusBorderColor = 'border-l-emerald-500'
              urgencyBadgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            } else if (isCritical) {
              statusBorderColor = 'border-l-red-500'
              urgencyBadgeClass = 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
            } else if (isHigh) {
              statusBorderColor = 'border-l-orange-500'
              urgencyBadgeClass = 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
            } else if (inc.urgency === 'MODERATE') {
              statusBorderColor = 'border-l-amber-500'
              urgencyBadgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }

            return (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`p-3.5 rounded-2xl border border-l-4 ${statusBorderColor} transition-all cursor-pointer select-none font-sans shadow-sm hover:shadow-md ${
                  isSelected
                    ? isLight
                      ? 'border-[var(--accent-primary)] bg-orange-50/40 ring-2 ring-[var(--accent-primary)]'
                      : 'border-[var(--accent-primary)] bg-[var(--bg-surface-elevated)] ring-2 ring-[var(--accent-primary)]'
                    : isLight
                      ? 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/40 hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={`font-mono text-xs font-black ${
                      isLight ? 'text-slate-900' : 'text-slate-100'
                    }`}
                  >
                    {inc.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase border ${
                        isLight
                          ? 'bg-slate-200/70 text-slate-700 border-slate-300'
                          : 'bg-[var(--bg-base)] text-slate-300 border-[var(--border-subtle)]'
                      }`}
                    >
                      {inc.detectedLanguage}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${urgencyBadgeClass}`}
                    >
                      {isResolved ? 'RESOLVED' : inc.urgency}
                    </span>
                  </div>
                </div>

                {/* Location with Pin Icon */}
                <div
                  className={`flex items-center gap-1 text-xs font-bold mb-1 ${
                    isLight ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  <MapPin size={12} className="text-[var(--accent-primary)] shrink-0" />
                  <span className="truncate">{inc.location.name}</span>
                </div>

                {/* Resident message snippet */}
                <p
                  className={`text-[11px] italic line-clamp-2 mb-2.5 leading-relaxed font-sans ${
                    isLight ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  "{inc.rawText}"
                </p>

                {/* Footer metadata */}
                <div
                  className={`flex items-center justify-between text-[10px] font-mono pt-1.5 border-t ${
                    isLight ? 'border-slate-200 text-slate-500' : 'border-[var(--border-subtle)]/40 text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1 font-medium">
                    <Clock size={11} />
                    {inc.timestamp}
                  </span>
                  <span
                    className={`font-bold uppercase tracking-wider flex items-center gap-1 ${
                      isResolved
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : isDispatched
                          ? 'text-blue-500 dark:text-blue-400'
                          : 'text-[var(--accent-primary)]'
                    }`}
                  >
                    {isResolved ? (
                      <>
                        <CheckCircle2 size={11} /> Resolved
                      </>
                    ) : isDispatched ? (
                      <>En Route ({inc.assignedUnitId})</>
                    ) : (
                      <>
                        <AlertCircle size={11} /> {inc.status.replace(/_/g, ' ')}
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
