import { ChevronLeft } from 'lucide-react'
import type { IncidentReport } from '../../types/cad'

export type KpiFilter = 'ALL' | 'CRITICAL' | 'ACTIVE' | 'PENDING' | 'RESOLVED'

export interface KPIStripProps {
  incidents: IncidentReport[]
  activeFilter: KpiFilter
  onFilterChange: (filter: KpiFilter) => void
  onClose?: () => void
  className?: string
}

export function KPIStrip({
  incidents,
  activeFilter,
  onFilterChange,
  onClose,
  className = '',
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

  const getPercentage = (count: number) => {
    if (totalCount === 0) return 0
    return Math.round((count / totalCount) * 100)
  }

  const kpiStats = [
    {
      id: 'ALL' as const,
      label: 'TOTAL INCIDENTS',
      shortLabel: 'ALL',
      value: totalCount,
      subtext: 'All Command Pins',
      tone: 'text-[var(--text-primary)]',
      border: 'border-[var(--border-subtle)]',
      barBg: 'bg-[var(--accent-primary)]',
      pct: 100,
      pulse: false,
    },
    {
      id: 'CRITICAL' as const,
      label: 'CRITICAL',
      shortLabel: 'CRIT',
      value: criticalCount,
      subtext: `${getPercentage(criticalCount)}% High Urgency`,
      tone: 'text-red-400',
      border: 'border-red-500/40',
      barBg: 'bg-red-500',
      pct: getPercentage(criticalCount),
      pulse: criticalCount > 0,
    },
    {
      id: 'ACTIVE' as const,
      label: 'ACTIVE NEEDS',
      shortLabel: 'ACTIVE',
      value: activeCount,
      subtext: `${getPercentage(activeCount)}% In Progress`,
      tone: 'text-orange-400',
      border: 'border-orange-500/40',
      barBg: 'bg-orange-500',
      pct: getPercentage(activeCount),
      pulse: false,
    },
    {
      id: 'PENDING' as const,
      label: 'AWAITING DISPATCH',
      shortLabel: 'PENDING',
      value: pendingCount,
      subtext: `${getPercentage(pendingCount)}% In Pipeline`,
      tone: 'text-amber-400',
      border: 'border-amber-500/40',
      barBg: 'bg-amber-500',
      pct: getPercentage(pendingCount),
      pulse: pendingCount > 0,
    },
    {
      id: 'RESOLVED' as const,
      label: 'RESOLVED',
      shortLabel: 'CLEARED',
      value: resolvedCount,
      subtext: `${getPercentage(resolvedCount)}% Cleared`,
      tone: 'text-emerald-400',
      border: 'border-emerald-500/40',
      barBg: 'bg-emerald-500',
      pct: getPercentage(resolvedCount),
      pulse: false,
    },
  ]

  return (
    <div className={`pointer-events-auto flex flex-col select-none w-56 sm:w-60 ${className}`.trim()}>
      {/* Header with Title and Collapse Button */}
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[var(--text-secondary)]">
          Priority Metrics
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
            title="Hide Priority Filter"
            aria-label="Hide Priority Filter"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Vertically Stacked Metric Cards */}
      <div className="flex flex-col gap-2">
        {kpiStats.map((stat) => {
          const isSelected = activeFilter === stat.id
          return (
            <button
              key={stat.id}
              type="button"
              onClick={() => onFilterChange(stat.id)}
              className={`group relative overflow-hidden flex h-13 w-full items-center border bg-[var(--bg-surface)]/90 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-[var(--accent-primary)] -skew-x-6 cursor-pointer text-left rounded-sm ${
                stat.border
              } ${
                isSelected
                  ? 'ring-1 sm:ring-2 ring-[var(--accent-primary)] opacity-100 z-10 bg-[var(--bg-surface-elevated)] shadow-md shadow-[var(--accent-primary)]/20'
                  : 'opacity-90 hover:opacity-100'
              }`}
              title={`Filter by ${stat.label}: ${stat.value} reports (${stat.pct}%)`}
            >
              {/* Proportional Occupancy Fill Bar */}
              <div
                className={`absolute inset-y-0 left-0 opacity-15 pointer-events-none transition-all duration-500 ${stat.barBg}`}
                style={{ width: `${stat.pct}%` }}
              />

              {/* Bottom Accent Bar */}
              <div className="absolute bottom-0 left-0 h-1 bg-[var(--border-subtle)]/50 w-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${stat.barBg}`}
                  style={{ width: `${stat.pct}%` }}
                />
              </div>

              {/* Content (Unskewed) */}
              <div className="relative z-10 flex w-full items-center justify-between gap-2 px-3 py-1 skew-x-6">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                    {stat.label}
                  </span>
                  <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-tight truncate">
                    {stat.subtext}
                  </span>
                </div>
                <span
                  className={`text-lg font-mono font-bold shrink-0 leading-none ${
                    stat.tone
                  } ${stat.pulse ? 'animate-pulse' : ''}`}
                >
                  {stat.value}
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
