import { X, Shield, CheckCircle2, Radio, FileText, MapPin, Activity } from 'lucide-react'
import { useTheme } from '../../context'

export interface ArchivedIncidentRecord {
  id: string
  loggedAt: string | null
  category: string | null
  urgency: string | null
  locationName: string | null
  rawText: string | null
  translation: string | null
  assignedUnitId: string | null
  status: string | null
  pathway: string | null
  timeline: {
    ingestion: string | null
    nlpClassification: string | null
    commanderAuthorization: string | null
    fieldArrival: string | null
    resolution: string | null
  }
}

export interface AuditTrailModalProps {
  incident: ArchivedIncidentRecord | null
  onClose: () => void
}

export function AuditTrailModal({ incident, onClose }: AuditTrailModalProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  if (!incident) return null

  const timelineSteps = [
    {
      title: 'Report Ingested',
      timestamp: incident.timeline.ingestion ?? 'N/A',
      desc: `Signal received via ${incident.pathway ?? 'N/A'}. Awaiting gateway confirmation.`,
      icon: Radio,
    },
    {
      title: 'AI / NLP Classification',
      timestamp: incident.timeline.nlpClassification ?? 'N/A',
      desc: 'Dialect parsed, urgency scored, and response proposal generated.',
      icon: Activity,
    },
    {
      title: 'Commander Authorization',
      timestamp: incident.timeline.commanderAuthorization ?? 'N/A',
      desc: `Dispatch confirmed and transmitted to ${incident.assignedUnitId ?? 'N/A'}.`,
      icon: Shield,
    },
    {
      title: 'Field Unit Arrival',
      timestamp: incident.timeline.fieldArrival ?? 'N/A',
      desc: 'Responder terminal reported on-scene coordinates.',
      icon: MapPin,
    },
    {
      title: 'Incident Cleared & Resolved',
      timestamp: incident.timeline.resolution ?? 'N/A',
      desc: 'All field tasks complete. Case archived for government audit.',
      icon: CheckCircle2,
    },
  ]

  return (
    <div
      data-testid="audit-trail-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        data-testid="audit-trail-modal"
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
          isLight
            ? 'bg-white border-slate-300 text-slate-900 shadow-slate-400/40'
            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/80'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/60 border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-base sm:text-lg uppercase tracking-wide truncate">
                  Incident Audit Log: {incident.id}
                </h3>
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[var(--accent-primary)]">
                  {incident.status ?? 'N/A'}
                </span>
              </div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Location: {incident.locationName ?? 'N/A'} &bull; Assigned: {incident.assignedUnitId ?? 'N/A'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isLight
                ? 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:text-white hover:border-[var(--accent-primary)]'
            }`}
            title="Close Audit Log"
            aria-label="Close Audit Log"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto salbar-scrollbar flex-1 font-sans">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              className={`p-3 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/30 border-[var(--border-subtle)]'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Category
              </span>
              <span className="font-mono text-xs font-black block truncate">
                {incident.category ?? 'N/A'}
              </span>
            </div>

            <div
              className={`p-3 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/30 border-[var(--border-subtle)]'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Urgency
              </span>
              <span className="font-mono text-xs font-black block truncate">
                {incident.urgency ?? 'N/A'}
              </span>
            </div>

            <div
              className={`p-3 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/30 border-[var(--border-subtle)]'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Logged At
              </span>
              <span className="font-mono text-xs font-black block truncate">
                {incident.loggedAt ?? 'N/A'}
              </span>
            </div>

            <div
              className={`p-3 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/30 border-[var(--border-subtle)]'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Mesh Pathway
              </span>
              <span className="font-mono text-xs font-black block truncate">
                {incident.pathway ?? 'N/A'}
              </span>
            </div>
          </div>

          {/* Raw Text & NLP Box */}
          <div
            className={`p-4 rounded-2xl border space-y-2 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
            }`}
          >
            <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)] block">
              Resident Message & NLP Translation
            </span>
            <div className="space-y-1 text-xs">
              <p className="italic text-[var(--text-secondary)]">
                Raw Input: {incident.rawText ? `"${incident.rawText}"` : 'N/A'}
              </p>
              <p className="font-medium">
                Normalized Translation: {incident.translation ? `"${incident.translation}"` : 'N/A'}
              </p>
            </div>
          </div>

          {/* Chronological Audit Trail Timeline */}
          <div className="space-y-3">
            <span className="font-heading font-black text-xs uppercase tracking-wider block">
              Disaster Operations Lifecycle (RDANA Standard)
            </span>

            <div className="space-y-3 border-l-2 border-[var(--border-subtle)] ml-3 pl-4">
              {timelineSteps.map((step, idx) => {
                const StepIcon = step.icon

                return (
                  <div key={idx} className="relative flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center -ml-[31px] shrink-0 border border-[var(--accent-primary)]/40">
                      <StepIcon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-heading font-black text-xs uppercase tracking-wide">
                          {step.title}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--text-secondary)] font-bold">
                          {step.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-end shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/60 border-[var(--border-subtle)]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            Close Audit Log
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuditTrailModal
