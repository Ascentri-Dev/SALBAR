export interface IncidentArchiveScreenProps {
  className?: string
}

export function IncidentArchiveScreen({ className = '' }: IncidentArchiveScreenProps) {
  return (
    <div
      data-testid="screen-incident-archive"
      className={`screen-incident-archive flex-1 flex flex-col p-6 overflow-y-auto ${className}`.trim()}
    >
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Incident Archive & Audit History
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Post-disaster audit log, RDANA compliance records, and civilian report history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] bg-[var(--bg-surface)]"
            disabled
          >
            Export CSV
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] bg-[var(--bg-surface)]"
            disabled
          >
            Export PDF
          </button>
        </div>
      </header>

      {/* Filter and Search Bar Placeholder */}
      <section
        data-testid="archive-filters-bar"
        className="mb-6 p-4 rounded border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)] flex items-center justify-between"
      >
        <span>[Search & Filter Controls Skeleton Placeholder]</span>
      </section>

      {/* Incident Log Table / Audit Trail Placeholder */}
      <section
        data-testid="archive-table-container"
        className="flex-1 min-h-[300px] rounded border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-sm text-[var(--text-secondary)]"
      >
        [Incident Archive & Audit Trail Table Skeleton Placeholder]
      </section>
    </div>
  )
}

export default IncidentArchiveScreen
