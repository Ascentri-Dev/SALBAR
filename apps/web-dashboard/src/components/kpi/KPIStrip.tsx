import type { IncidentReport } from '../../types/cad'

export type KpiFilter = 'ALL' | 'CRITICAL' | 'ACTIVE' | 'PENDING' | 'RESOLVED'

export interface KPIStripProps {
  incidents: IncidentReport[]
  activeFilter: KpiFilter
  onFilterChange: (filter: KpiFilter) => void
}

export function KPIStrip({
  incidents,
  activeFilter,
  onFilterChange,
}: KPIStripProps) {
  const totalCount = incidents.length
  const criticalCount = incidents.filter(
    (i) => i.urgency === 'CRITICAL' && i.status !== 'RESOLVED'
  ).length
  const activeCount = incidents.filter(
    (i) => i.status === 'UNASSIGNED' || i.status === 'PROPOSAL_PENDING'
  ).length
  const pendingCount = incidents.filter(
    (i) => i.status === 'PROPOSAL_PENDING'
  ).length
  const resolvedCount = incidents.filter(
    (i) => i.status === 'RESOLVED'
  ).length

  const metrics = [
    {
      id: 'ALL' as const,
      label: 'TOTAL INCIDENTS',
      value: totalCount,
      tone: 'text-[var(--text-primary)]',
      border: 'border-[var(--border-subtle)]',
    },
    {
      id: 'CRITICAL' as const,
      label: 'CRITICAL',
      value: criticalCount,
      tone: 'text-[var(--color-emergency-critical)]',
      border: 'border-red-500/50',
      pulse: criticalCount > 0,
    },
    {
      id: 'ACTIVE' as const,
      label: 'ACTIVE NEEDS',
      value: activeCount,
      tone: 'text-[var(--color-emergency-high)]',
      border: 'border-orange-500/50',
    },
    {
      id: 'PENDING' as const,
      label: 'AWAITING DISPATCH',
      value: pendingCount,
      tone: 'text-[var(--color-emergency-moderate)]',
      border: 'border-amber-500/50',
    },
    {
      id: 'RESOLVED' as const,
      label: 'RESOLVED',
      value: resolvedCount,
      tone: 'text-[var(--color-emergency-success)]',
      border: 'border-emerald-500/50',
    },
  ]

  return (
    <div className="w-full flex items-center justify-center pointer-events-none">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full max-w-4xl px-2">
        {metrics.map((metric) => {
          const isSelected = activeFilter === metric.id
          return (
            <button
              key={metric.id}
              type="button"
              onClick={() => onFilterChange(metric.id)}
              className={`pointer-events-auto group relative overflow-hidden flex min-h-[46px] items-center border ${
                metric.border
              } bg-[var(--bg-surface)]/85 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-[var(--accent-primary)] -skew-x-12 cursor-pointer ${
                isSelected
                  ? 'ring-1 ring-[var(--accent-primary)] bg-[var(--bg-surface-elevated)] opacity-100 scale-[1.02]'
                  : 'opacity-85 hover:opacity-100'
              }`}
            >
              <div className="relative z-10 flex w-full items-center justify-between gap-2 px-3 py-1.5 skew-x-12">
                <span className="text-[10px] font-bold tracking-wider text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] uppercase transition-colors truncate">
                  {metric.label}
                </span>
                <span
                  className={`text-base leading-none font-mono font-bold shrink-0 ${
                    metric.tone
                  } ${metric.pulse ? 'animate-pulse' : ''}`}
                >
                  {metric.value}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default KPIStrip

