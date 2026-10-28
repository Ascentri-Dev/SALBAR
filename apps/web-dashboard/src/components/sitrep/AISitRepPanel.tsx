import { Bot, AlertOctagon, ShieldCheck, MapPin } from 'lucide-react'
import type { IncidentReport, FieldResponder, RoadHazard } from '../../types/cad'

export interface AISitRepPanelProps {
  incidents: IncidentReport[]
  responders: FieldResponder[]
  hazards: RoadHazard[]
  onFocusIncident: (incident: IncidentReport) => void
}

export function AISitRepPanel({
  incidents,
  responders,
  hazards,
  onFocusIncident,
}: AISitRepPanelProps) {
  const criticalIncidents = incidents.filter(
    (i) => i.urgency === 'CRITICAL' && i.status !== 'RESOLVED'
  )
  const availableResponders = responders.filter((r) => r.status === 'AVAILABLE')

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]/95 backdrop-blur-xl border-r border-[var(--border-subtle)] text-[var(--text-primary)] shadow-2xl p-4 overflow-y-auto space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
        <Bot size={18} className="text-[var(--accent-primary)]" />
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            AI Situation Briefing (SitRep)
          </h2>
          <span className="text-[10px] font-mono text-[var(--text-secondary)]">
            Constrained Propose-Only Summary
          </span>
        </div>
      </div>

      {/* Critical Life-Safety Alert Box */}
      {criticalIncidents.length > 0 && (
        <div className="p-3 rounded border border-red-500/40 bg-red-500/10 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wide">
            <AlertOctagon size={14} className="animate-pulse" />
            <span>{criticalIncidents.length} Critical Emergencies</span>
          </div>
          <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">
            Immediate life-safety interventions requested in riverine and slope zones. Water rescue and extrication teams recommended.
          </p>
          <div className="space-y-1 pt-1">
            {criticalIncidents.map((inc) => (
              <button
                key={inc.id}
                type="button"
                onClick={() => onFocusIncident(inc)}
                className="w-full text-left p-1.5 rounded bg-[var(--bg-surface)] border border-red-500/30 text-[11px] font-mono hover:border-red-400 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">{inc.location.name}</span>
                <span className="text-[10px] text-red-400 shrink-0 flex items-center gap-1">
                  <MapPin size={10} /> Focus
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Operational Capacity Overview */}
      <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)]/50 space-y-2 text-xs">
        <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)] uppercase">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            Fleet Readiness
          </span>
          <span className="font-mono text-emerald-400">
            {availableResponders.length}/{responders.length} Ready
          </span>
        </div>
        <div className="space-y-1.5 text-[11px] font-mono text-[var(--text-secondary)]">
          {responders.map((resp) => (
            <div key={resp.id} className="flex justify-between items-center">
              <span>{resp.name}</span>
              <span className={resp.status === 'AVAILABLE' ? 'text-emerald-400' : 'text-amber-400'}>
                {resp.status} ({resp.fatigueScore}% fat.)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Active Road Hazards */}
      {hazards.length > 0 && (
        <div className="p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)]/50 space-y-2 text-xs">
          <div className="font-bold text-[var(--text-primary)] uppercase text-[11px]">
            Active Route Impediments ({hazards.length})
          </div>
          <div className="space-y-1.5 text-[11px] font-mono text-[var(--text-secondary)]">
            {hazards.map((h) => (
              <div key={h.id} className="border-b border-[var(--border-subtle)]/40 pb-1 last:border-0">
                <div className="text-[var(--text-primary)] font-semibold truncate">{h.name}</div>
                <div className="text-[10px] text-amber-400">+{h.penaltyMinutes} min reroute penalty</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AISitRepPanel

