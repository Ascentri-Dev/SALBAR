import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Variants } from 'framer-motion'
import {
  FileText,
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Shield,
  ChevronRight,
} from 'lucide-react'
import { useTheme } from '../../context'
import { AuditTrailModal, type ArchivedIncidentRecord } from './AuditTrailModal'

export interface IncidentArchiveScreenProps {
  className?: string
}

// Unconnected / Template Records without fake data (filled with N/A)
const DEFAULT_ARCHIVE_RECORDS: ArchivedIncidentRecord[] = [
  {
    id: 'INC-N/A-01',
    loggedAt: null,
    category: null,
    urgency: null,
    locationName: null,
    rawText: null,
    translation: null,
    assignedUnitId: null,
    status: 'N/A',
    pathway: null,
    timeline: {
      ingestion: null,
      nlpClassification: null,
      commanderAuthorization: null,
      fieldArrival: null,
      resolution: null,
    },
  },
  {
    id: 'INC-N/A-02',
    loggedAt: null,
    category: null,
    urgency: null,
    locationName: null,
    rawText: null,
    translation: null,
    assignedUnitId: null,
    status: 'N/A',
    pathway: null,
    timeline: {
      ingestion: null,
      nlpClassification: null,
      commanderAuthorization: null,
      fieldArrival: null,
      resolution: null,
    },
  },
  {
    id: 'INC-N/A-03',
    loggedAt: null,
    category: null,
    urgency: null,
    locationName: null,
    rawText: null,
    translation: null,
    assignedUnitId: null,
    status: 'N/A',
    pathway: null,
    timeline: {
      ingestion: null,
      nlpClassification: null,
      commanderAuthorization: null,
      fieldArrival: null,
      resolution: null,
    },
  },
]

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

export function IncidentArchiveScreen({ className = '' }: IncidentArchiveScreenProps) {
  const { theme, isNavbarOpen } = useTheme()
  const isLight = theme === 'light'

  const [records] = useState<ArchivedIncidentRecord[]>(DEFAULT_ARCHIVE_RECORDS)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | string>('ALL')
  const [selectedIncident, setSelectedIncident] = useState<ArchivedIncidentRecord | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q)) ||
        (r.locationName && r.locationName.toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
  }, [records, statusFilter, searchQuery])

  const handleExportCSV = () => {
    setExportNotice('CSV Export: Generated template archive export (Awaiting Backend Records).')
    setTimeout(() => setExportNotice(null), 3000)
  }

  const handleExportPDF = () => {
    setExportNotice('PDF Export: Formatted RDANA report template prepared.')
    setTimeout(() => setExportNotice(null), 3000)
  }

  return (
    <div
      data-testid="screen-incident-archive"
      className={`screen-incident-archive flex-1 flex flex-col px-4 sm:px-6 lg:px-8 pb-8 overflow-y-auto salbar-scrollbar select-none font-sans transition-[padding] duration-300 ${
        isNavbarOpen ? 'pt-20 sm:pt-22' : 'pt-4 sm:pt-6'
      } ${className}`.trim()}
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl w-full mx-auto space-y-6"
      >
        {/* Screen Header & Export Action Pills */}
        <motion.header
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-heading tracking-wide uppercase text-[var(--text-primary)]">
              Incident Archive & Audit History
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
              Post-disaster audit log, RDANA compliance records, and civilian report history.
            </p>
          </div>

          {/* Export Action Controls: Circular Pills */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer active:scale-95 ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-800 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] shadow-sm'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-200 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] shadow-md shadow-black/40'
              }`}
            >
              <Download size={14} className="text-[var(--accent-primary)]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent-primary)] text-white text-xs font-black tracking-wider uppercase hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-md active:scale-95"
            >
              <Printer size={14} />
              <span>Export PDF (RDANA)</span>
            </button>
          </div>
        </motion.header>

        {/* Notice Banner when Export Triggered */}
        <AnimatePresence>
          {exportNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="p-3 rounded-2xl border text-xs font-bold text-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            >
              {exportNotice}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Archive Summary KPI Strip (4 Circular Cards with N/A) */}
        <motion.section
          variants={itemVariants}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {/* Total Archived */}
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center gap-3.5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Archived Reports
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                N/A
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] font-bold block truncate">
                Sync Status: N/A
              </span>
            </div>
          </div>

          {/* Resolution Rate */}
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center gap-3.5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Resolution Rate
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                N/A
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] font-bold block truncate">
                Resolved Ratio: N/A
              </span>
            </div>
          </div>

          {/* Average Response Time */}
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center gap-3.5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/15 text-amber-500 shrink-0">
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Avg Dispatch Time
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                N/A
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] font-bold block truncate">
                Telemetry: N/A
              </span>
            </div>
          </div>

          {/* Compliance Ready */}
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center gap-3.5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/15 text-blue-500 shrink-0">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Government Standard
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                RDANA Ready
              </span>
              <span className="text-[10px] text-blue-400 font-bold block truncate">
                NDRRMC Audit Standard
              </span>
            </div>
          </div>
        </motion.section>

        {/* Circular Search and Filter Bar */}
        <motion.section
          variants={itemVariants}
          data-testid="archive-filters-bar"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-md'
                  : isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:border-[var(--accent-primary)]'
              }`}
            >
              ALL ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                statusFilter === 'RESOLVED'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                  : isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:border-emerald-500'
              }`}
            >
              RESOLVED
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('DISPATCHED')}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                statusFilter === 'DISPATCHED'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-md'
                  : isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:border-[var(--accent-primary)]'
              }`}
            >
              DISPATCHED
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNASSIGNED')}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                statusFilter === 'UNASSIGNED'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                  : isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:border-amber-500'
              }`}
            >
              UNASSIGNED
            </button>
          </div>

          {/* Search Pill */}
          <div className="relative min-w-[240px]">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, category, location..."
              className={`w-full pl-9 pr-4 py-1.5 rounded-full border text-xs font-sans transition-colors focus:outline-none focus:border-[var(--accent-primary)] ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 placeholder:text-slate-400'
              }`}
            />
          </div>
        </motion.section>

        {/* Incident Archive Table Container (with required test ID) */}
        <motion.section
          variants={itemVariants}
          data-testid="archive-table-container"
          className={`rounded-3xl border shadow-xl overflow-hidden transition-all ${
            isLight
              ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/50'
          }`}
        >
          <div className="overflow-x-auto salbar-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              {/* Table Header */}
              <thead>
                <tr
                  className={`border-b font-mono font-black uppercase text-[10px] tracking-wider ${
                    isLight
                      ? 'bg-slate-100/70 border-slate-200 text-slate-700'
                      : 'bg-[var(--bg-surface-elevated)]/60 border-[var(--border-subtle)] text-slate-300'
                  }`}
                >
                  <th className="py-3.5 px-4">Incident ID</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Assigned Unit</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Audit Trail</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-200 dark:divide-[var(--border-subtle)]/40 font-sans">
                {filteredRecords.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isLight
                        ? 'hover:bg-slate-50'
                        : 'hover:bg-[var(--bg-surface-elevated)]/40'
                    }`}
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-[var(--accent-primary)]">
                      {item.id}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-mono text-[var(--text-secondary)]">
                      {item.loggedAt ?? 'N/A'}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] font-bold uppercase text-[var(--text-secondary)]">
                        {item.category ?? 'N/A'}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 text-[var(--text-secondary)] font-medium">
                      {item.locationName ?? 'N/A'}
                    </td>

                    {/* Assigned Unit */}
                    <td className="py-3.5 px-4 font-mono text-[var(--text-secondary)]">
                      {item.assignedUnitId ?? 'N/A'}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase bg-slate-500/10 text-[var(--text-secondary)] border-slate-300 dark:border-slate-700">
                        {item.status}
                      </span>
                    </td>

                    {/* Action Button: Circular Pill */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedIncident(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          isLight
                            ? 'bg-slate-100 hover:bg-[var(--accent-primary)] hover:text-white hover:border-[var(--accent-primary)] text-slate-800 border-slate-300'
                            : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--accent-primary)] hover:text-white hover:border-[var(--accent-primary)] text-slate-200 border-[var(--border-subtle)]'
                        }`}
                      >
                        <span>Audit Trail</span>
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty Search Filter State */}
          {filteredRecords.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
              <Filter size={28} className="text-[var(--accent-primary)] opacity-50" />
              <h3 className="font-heading font-black text-sm uppercase tracking-wider">
                No Archive Records Found
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                No archived disaster reports match your search query.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL')
                  setSearchQuery('')
                }}
                className="px-4 py-1.5 rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </motion.section>
      </motion.div>

      {/* Audit Trail Modal */}
      {selectedIncident && (
        <AuditTrailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  )
}

export default IncidentArchiveScreen
