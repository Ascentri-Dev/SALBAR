export interface CommandMapScreenProps {
  className?: string
}

export function CommandMapScreen({ className = '' }: CommandMapScreenProps) {
  return (
    <div
      data-testid="screen-command-map"
      className={`screen-command-map flex-1 flex flex-col md:flex-row h-full overflow-hidden ${className}`.trim()}
    >
      {/* Primary GIS Map Region */}
      <section
        data-testid="gis-map-container"
        className="flex-1 flex flex-col min-h-[360px] border-b md:border-b-0 md:border-r border-[var(--border-subtle)] p-4"
      >
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-mono mb-2">
          GIS Map & CAD Viewport
        </div>
        <div className="flex-1 rounded border border-dashed border-[var(--border-subtle)] flex items-center justify-center text-sm text-[var(--text-secondary)]">
          [Map Canvas Skeleton Placeholder]
        </div>
      </section>

      {/* Incident Stream & Dispatch Triage Drawer Region */}
      <aside
        data-testid="incident-stream-panel"
        className="w-full md:w-[420px] lg:w-[480px] flex flex-col p-4 bg-[var(--bg-surface)]"
      >
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-mono mb-2">
          Live Incident Stream & HITL Triage
        </div>
        <div className="flex-1 rounded border border-dashed border-[var(--border-subtle)] flex items-center justify-center text-sm text-[var(--text-secondary)] p-4 text-center">
          [Incident Feed & Dispatch Drawer Skeleton Placeholder]
        </div>
      </aside>
    </div>
  )
}

export default CommandMapScreen
