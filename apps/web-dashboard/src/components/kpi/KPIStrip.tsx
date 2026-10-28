import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import type { IncidentReport } from '../../types/cad'
import { useTheme } from '../../context'

export type KpiFilter = 'ALL' | 'CRITICAL' | 'ACTIVE' | 'PENDING' | 'RESOLVED'

export interface KPIStripProps {
  incidents: IncidentReport[]
  activeFilter: KpiFilter
  onFilterChange: (filter: KpiFilter) => void
  isOpen: boolean
  onToggleOpen: () => void
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

const cardVariants: Variants = {
  hidden: { x: -35, opacity: 0, scale: 0.94 },
  show: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    x: -35,
    opacity: 0,
    scale: 0.94,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
  },
}

export function KPIStrip({
  incidents,
  activeFilter,
  onFilterChange,
  isOpen,
  onToggleOpen,
  className = '',
}: KPIStripProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

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
      {/* Unified "METRICS" Toggle Button in Safety Orange */}
      <button
        type="button"
        onClick={onToggleOpen}
        className={`h-11 flex items-center justify-between gap-2.5 px-5 rounded-full border shadow-xl backdrop-blur-md transition-all cursor-pointer select-none group ${
          isLight
            ? 'bg-white border-slate-300 hover:border-[var(--accent-primary)]'
            : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] shadow-black/40'
        }`}
        title={isOpen ? 'Click "METRICS" to collapse' : 'Click "METRICS" to expand'}
        aria-label={isOpen ? 'Collapse Metrics' : 'Expand Metrics'}
      >
        <span className="font-heading font-black text-xs sm:text-sm tracking-widest uppercase text-[var(--accent-primary)] group-hover:text-[var(--accent-hover)] transition-colors">
          METRICS
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-[var(--accent-primary)] group-hover:text-[var(--accent-hover)] transition-colors"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      {/* Slower Staggered Animated Circular Pill Cards */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="flex flex-col gap-2.5 mt-2.5"
          >
            {kpiStats.map((stat) => {
              const isSelected = activeFilter === stat.id

              return (
                <motion.button
                  key={stat.id}
                  variants={cardVariants}
                  type="button"
                  onClick={() => onFilterChange(stat.id)}
                  className={`group relative overflow-hidden flex h-13 sm:h-14 w-full items-center justify-between rounded-full border px-5 sm:px-6 shadow-xl transition-all duration-300 cursor-pointer text-left ${
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
                  {/* High-Visibility Proportional Occupancy Meter Fill Bar */}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full opacity-25 dark:opacity-30 group-hover:opacity-45 pointer-events-none transition-all duration-500 ${stat.barBg}`}
                    style={{ width: `${stat.pct}%` }}
                  />

                  {/* Header & Percentage-Only Subheader */}
                  <div className="flex flex-col z-10 min-w-0">
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
        )}
      </AnimatePresence>
    </div>
  )
}

export default KPIStrip
