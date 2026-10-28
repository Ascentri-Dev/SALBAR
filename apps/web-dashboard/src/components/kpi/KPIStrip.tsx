import { useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import type { IncidentReport } from '../../types/cad'

export type KpiFilter = 'ALL' | 'CRITICAL' | 'ACTIVE' | 'PENDING' | 'RESOLVED'

export interface KPIStripProps {
  incidents: IncidentReport[]
  activeFilter: KpiFilter
  onFilterChange: (filter: KpiFilter) => void
  className?: string
}

export function KPIStrip({
  incidents,
  activeFilter,
  onFilterChange,
  className = '',
}: KPIStripProps) {
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false)

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
      label: 'All Incidents',
      count: totalCount,
      pct: 100,
      color: '#3b82f6',
      badgeClass: 'text-[var(--text-primary)]',
      borderClass: 'border-[var(--border-subtle)]',
    },
    {
      id: 'CRITICAL' as const,
      label: 'Critical Priority',
      count: criticalCount,
      pct: getPercentage(criticalCount),
      color: '#ef4444',
      badgeClass: 'text-[var(--color-emergency-critical)]',
      borderClass: 'border-red-500/40',
      pulse: criticalCount > 0,
    },
    {
      id: 'ACTIVE' as const,
      label: 'Active Needs',
      count: activeCount,
      pct: getPercentage(activeCount),
      color: '#f97316',
      badgeClass: 'text-[var(--color-emergency-high)]',
      borderClass: 'border-orange-500/40',
    },
    {
      id: 'PENDING' as const,
      label: 'Awaiting Triage',
      count: pendingCount,
      pct: getPercentage(pendingCount),
      color: '#f59e0b',
      badgeClass: 'text-[var(--color-emergency-moderate)]',
      borderClass: 'border-amber-500/40',
    },
    {
      id: 'RESOLVED' as const,
      label: 'Resolved',
      count: resolvedCount,
      pct: getPercentage(resolvedCount),
      color: '#10b981',
      badgeClass: 'text-[var(--color-emergency-success)]',
      borderClass: 'border-emerald-500/40',
    },
  ]

  return (
    <div className={`pointer-events-none flex flex-col items-center select-none ${className}`.trim()}>
      <div className="relative pointer-events-auto">
        {/* KPI Metric Items Strip */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isFilterCollapsed
              ? 'opacity-0 -translate-y-4 pointer-events-none max-h-0'
              : 'opacity-100 translate-y-0 max-h-24'
          }`}
        >
          <div className="bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] rounded-sm shadow-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto max-w-[94vw]">
            {kpiStats.map((stat) => {
              const isSelected = activeFilter === stat.id
              return (
                <button
                  key={stat.id}
                  type="button"
                  onClick={() => onFilterChange(stat.id)}
                  className={`px-3 py-1.5 rounded-sm flex items-center gap-2.5 transition-all text-xs cursor-pointer select-none border relative overflow-hidden group shrink-0 ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-elevated)] ring-1 ring-[var(--accent-primary)]/50'
                      : `${stat.borderClass} bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)]`
                  }`}
                >
                  {/* Proportional Occupancy Progress Bar Background */}
                  <div
                    className="absolute left-0 top-0 bottom-0 opacity-15 transition-all duration-500 group-hover:opacity-25"
                    style={{ width: `${stat.pct}%`, backgroundColor: stat.color }}
                  />

                  {/* Label */}
                  <span className="font-sans font-semibold text-xs text-[var(--text-primary)] z-10">
                    {stat.label}
                  </span>

                  {/* Count & Percentage Badge */}
                  <div className="flex items-center gap-1.5 z-10">
                    <span
                      className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] bg-black/20 ${
                        stat.badgeClass
                      } ${stat.pulse ? 'animate-pulse' : ''}`}
                    >
                      {stat.count}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      {stat.pct}%
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Collapse / Expand Toggle Button Tab */}
        <button
          type="button"
          onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
          className="mx-auto mt-0.5 px-3 py-0.5 bg-[var(--bg-surface)]/85 hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] border-t-0 rounded-b text-[10px] font-sans font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 shadow transition-colors cursor-pointer"
        >
          <SlidersHorizontal size={11} className="text-[var(--accent-primary)]" />
          <span>{isFilterCollapsed ? 'SHOW METRICS' : 'HIDE METRICS'}</span>
          {isFilterCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>
    </div>
  )
}

export default KPIStrip
