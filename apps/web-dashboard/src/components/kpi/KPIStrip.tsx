import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, type Variants } from 'framer-motion'
import type { IncidentReport } from '../../types/cad'
import { useTheme } from '../../context'

export type KpiFilter = 'ALL' | 'CRITICAL' | 'ACTIVE' | 'PENDING' | 'RESOLVED'

export interface KPIStripProps {
  incidents: IncidentReport[]
  activeFilter: KpiFilter
  onFilterChange: (filter: KpiFilter) => void
  onClose: () => void
  align?: 'left' | 'right'
  className?: string
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
}

const getCardVariants = (align: 'left' | 'right'): Variants => ({
  hidden: { x: align === 'right' ? 35 : -35, opacity: 0, scale: 0.94 },
  show: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    x: align === 'right' ? 35 : -35,
    opacity: 0,
    scale: 0.94,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
  },
})

export function KPIStrip({
  incidents,
  activeFilter,
  onFilterChange,
  onClose,
  align = 'left',
  className = '',
}: KPIStripProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const cardVariants = getCardVariants(align)

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
      value: totalCount,
      pct: 100,
      pctText: '100%',
      tone: isLight ? 'text-slate-900' : 'text-slate-100',
      border: isLight ? 'border-slate-300' : 'border-[var(--border-subtle)]',
      barBg: 'bg-[var(--accent-primary)]',
      pulse: false,
    },
    {
      id: 'CRITICAL' as const,
      label: 'CRITICAL',
      value: criticalCount,
      pct: getPercentage(criticalCount),
      pctText: `${getPercentage(criticalCount)}%`,
      tone: 'text-red-500 dark:text-red-400',
      border: 'border-red-500/40',
      barBg: 'bg-red-500',
      pulse: criticalCount > 0,
    },
    {
      id: 'ACTIVE' as const,
      label: 'ACTIVE NEEDS',
      value: activeCount,
      pct: getPercentage(activeCount),
      pctText: `${getPercentage(activeCount)}%`,
      tone: 'text-orange-500 dark:text-orange-400',
      border: 'border-orange-500/40',
      barBg: 'bg-orange-500',
      pulse: false,
    },
    {
      id: 'PENDING' as const,
      label: 'AWAITING DISPATCH',
      value: pendingCount,
      pct: getPercentage(pendingCount),
      pctText: `${getPercentage(pendingCount)}%`,
      tone: 'text-amber-500 dark:text-amber-400',
      border: 'border-amber-500/40',
      barBg: 'bg-amber-500',
      pulse: pendingCount > 0,
    },
    {
      id: 'RESOLVED' as const,
      label: 'RESOLVED',
      value: resolvedCount,
      pct: getPercentage(resolvedCount),
      pctText: `${getPercentage(resolvedCount)}%`,
      tone: 'text-emerald-500 dark:text-emerald-400',
      border: 'border-emerald-500/40',
      barBg: 'bg-emerald-500',
      pulse: false,
    },
  ]

  return (
    <div className={`pointer-events-auto flex flex-col select-none w-60 sm:w-64 ${className}`.trim()}>
      {/* Header: Orange "METRICS" Title & Circular Close Button (swapped position based on align) */}
      <div className="flex items-center justify-between px-2 mb-2.5">
        {align === 'right' ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
              }`}
              title="Hide Metrics"
              aria-label="Hide Metrics"
            >
              <ChevronRight size={16} />
            </button>
            <span className="font-heading font-black text-xs sm:text-sm tracking-widest uppercase text-[var(--accent-primary)]">
              METRICS
            </span>
          </>
        ) : (
          <>
            <span className="font-heading font-black text-xs sm:text-sm tracking-widest uppercase text-[var(--accent-primary)]">
              METRICS
            </span>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-700 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
              }`}
              title="Hide Metrics"
              aria-label="Hide Metrics"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Staggered Animated Circular Pill Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        className="flex flex-col gap-2.5"
      >
        {kpiStats.map((stat) => {
          const isSelected = activeFilter === stat.id

          return (
            <motion.button
              key={stat.id}
              variants={cardVariants}
              type="button"
              onClick={() => onFilterChange(stat.id)}
              className={`group relative overflow-hidden flex h-13 sm:h-14 w-full items-center justify-between rounded-full border px-5 sm:px-6 shadow-xl transition-all duration-300 cursor-pointer ${
                stat.border
              } ${
                isLight
                  ? isSelected
                    ? 'ring-2 ring-[var(--accent-primary)] bg-white border-[var(--accent-primary)] shadow-md'
                    : 'bg-white hover:border-[var(--accent-primary)]'
                  : isSelected
                    ? 'ring-2 ring-[var(--accent-primary)] bg-[var(--bg-surface-elevated)] border-[var(--accent-primary)] shadow-md shadow-[var(--accent-primary)]/20'
                    : 'bg-[var(--bg-surface)] hover:border-[var(--accent-primary)]'
              }`}
              title={`Filter by ${stat.label}: ${stat.value} reports (${stat.pctText})`}
            >
              {/* High-Visibility Proportional Occupancy Meter Fill Bar: Always starts from the left */}
              <div
                className={`absolute inset-y-0 left-0 rounded-full opacity-25 dark:opacity-30 group-hover:opacity-45 pointer-events-none transition-all duration-500 ${stat.barBg}`}
                style={{ width: `${stat.pct}%` }}
              />

              {/* Header & Percentage-Only Subheader */}
              <div className="flex flex-col z-10 min-w-0 text-left">
                <span
                  className={`font-heading font-black text-xs sm:text-sm tracking-wider uppercase transition-colors ${
                    isSelected
                      ? 'text-[var(--accent-primary)]'
                      : isLight
                        ? 'text-slate-900 group-hover:text-[var(--accent-primary)]'
                        : 'text-slate-100 group-hover:text-[var(--accent-primary)]'
                  }`}
                >
                  {stat.label}
                </span>
                <span className="font-mono font-bold text-[10px] sm:text-[11px] text-[var(--text-muted)] dark:text-slate-400">
                  {stat.pctText}
                </span>
              </div>

              {/* Big, Bold Numeric Count */}
              <span
                className={`font-mono font-black text-lg sm:text-xl shrink-0 z-10 leading-none ${
                  stat.tone
                } ${stat.pulse ? 'animate-pulse' : ''}`}
              >
                {stat.value}
              </span>
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}

export default KPIStrip
