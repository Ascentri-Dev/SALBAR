import { useState, useMemo } from 'react'
import {
  Shield,
  Activity,
  Battery,
  Crosshair,
  Radio,
  Cpu,
  MapPin,
  Search,
  Filter,
  CheckCircle2,
  Coffee,
  SlidersHorizontal,
} from 'lucide-react'
import { INITIAL_RESPONDERS, INITIAL_INCIDENTS } from '../../data/mockCadData'
import type { FieldResponder, ResponderStatus } from '../../types/cad'
import type { ScreenId } from '../../types/navigation'
import { useTheme } from '../../context'
import { UnitInspectorModal } from './UnitInspectorModal'

export interface FleetManagementScreenProps {
  onSelectScreen?: (screenId: ScreenId) => void
  className?: string
}

export function FleetManagementScreen({
  onSelectScreen,
  className = '',
}: FleetManagementScreenProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [responders, setResponders] = useState<FieldResponder[]>(INITIAL_RESPONDERS)
  const [statusFilter, setStatusFilter] = useState<'ALL' | ResponderStatus>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [inspectingUnit, setInspectingUnit] = useState<FieldResponder | null>(null)

  // Status Counts
  const availableCount = responders.filter((r) => r.status === 'AVAILABLE').length
  const enRouteCount = responders.filter((r) => r.status === 'EN_ROUTE').length
  const onSceneCount = responders.filter((r) => r.status === 'ON_SCENE').length
  const restingCount = responders.filter((r) => r.status === 'RESTING').length
  const totalReportsRelayed = responders.reduce((acc, r) => acc + r.relayedReportsCount, 0)
  const averageFatigue = Math.round(
    responders.reduce((acc, r) => acc + r.fatigueScore, 0) / (responders.length || 1)
  )

  // Filtered Responders
  const filteredResponders = useMemo(() => {
    return responders.filter((r) => {
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [responders, statusFilter, searchQuery])

  // Status Handlers
  const handleUpdateStatus = (unitId: string, newStatus: ResponderStatus) => {
    setResponders((prev) =>
      prev.map((r) => (r.id === unitId ? { ...r, status: newStatus } : r))
    )
    if (inspectingUnit?.id === unitId) {
      setInspectingUnit((prev) => (prev ? { ...prev, status: newStatus } : null))
    }
  }

  const handleToggleRest = (unitId: string) => {
    setResponders((prev) =>
      prev.map((r) => {
        if (r.id !== unitId) return r
        const isResting = r.status === 'RESTING'
        return {
          ...r,
          status: isResting ? 'AVAILABLE' : 'RESTING',
        }
      })
    )
  }

  const handleUpdateFatigue = (unitId: string, newFatigueScore: number) => {
    setResponders((prev) =>
      prev.map((r) => (r.id === unitId ? { ...r, fatigueScore: newFatigueScore } : r))
    )
    if (inspectingUnit?.id === unitId) {
      setInspectingUnit((prev) => (prev ? { ...prev, fatigueScore: newFatigueScore } : null))
    }
  }

  const getStatusBadge = (status: ResponderStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return {
          label: 'AVAILABLE',
          style: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500 animate-pulse',
        }
      case 'EN_ROUTE':
        return {
          label: 'EN ROUTE',
          style: 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--accent-primary)]/30',
          dot: 'bg-[var(--accent-primary)] animate-ping',
        }
      case 'ON_SCENE':
        return {
          label: 'ON SCENE',
          style: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
          dot: 'bg-cyan-500',
        }
      case 'RESTING':
        return {
          label: 'RESTING',
          style: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
          dot: 'bg-purple-500',
        }
      default:
        return {
          label: 'OFFLINE',
          style: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
          dot: 'bg-slate-500',
        }
    }
  }

  const getRoleBadge = (role: FieldResponder['role']) => {
    switch (role) {
      case 'Search and Rescue':
        return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
      case 'Damage Assessment':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      case 'Relief Operations':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
    }
  }

  const getFatigueColor = (score: number) => {
    if (score < 35) return { bar: 'bg-emerald-500', text: 'text-emerald-500', label: 'OPTIMAL CONDITION' }
    if (score < 65) return { bar: 'bg-amber-500', text: 'text-amber-500', label: 'MODERATE LOAD' }
    return { bar: 'bg-red-500', text: 'text-red-500', label: 'HIGH FATIGUE' }
  }

  return (
    <div
      data-testid="screen-fleet-management"
      className={`screen-fleet-management flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto salbar-scrollbar select-none font-sans ${className}`.trim()}
    >
      <div className="max-w-7xl w-full mx-auto space-y-6">
        {/* Screen Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-heading tracking-wide uppercase text-[var(--text-primary)]">
              Field Responder Fleet Management
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
              Real-time terminal telemetry, fatigue indices, and operational status for deployed units.
            </p>
          </div>

          {/* Quick Fleet Health Badges */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              3/3 Terminals Mesh Online
            </span>
          </div>
        </header>

        {/* Fleet KPI Summary Strip (4 Circular Cards) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Active Units */}
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center gap-3.5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] shrink-0">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Deployed Terminals
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                {responders.length} Units
              </span>
              <span className="text-[10px] text-emerald-500 font-bold block truncate">
                100% LoRa Connected
              </span>
            </div>
          </div>

          {/* Operational Readiness */}
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
                Readiness State
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                {availableCount} Available
              </span>
              <span className="text-[10px] text-[var(--accent-primary)] font-bold block truncate">
                {enRouteCount + onSceneCount} Deployed to Tasks
              </span>
            </div>
          </div>

          {/* Average Fatigue */}
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center gap-3.5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500/15 text-amber-500 shrink-0">
              <Activity size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                Fleet Avg Fatigue
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                {averageFatigue}%
              </span>
              <span className="text-[10px] text-emerald-500 font-bold block truncate">
                {averageFatigue < 50 ? 'Optimal Readiness' : 'Rest Advised'}
              </span>
            </div>
          </div>

          {/* Relayed Reports */}
          <div
            className={`p-4 rounded-3xl border shadow-md flex items-center gap-3.5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/50'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/40'
            }`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/15 text-blue-500 shrink-0">
              <Cpu size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)] block">
                BLE Mesh Packets
              </span>
              <span className="text-lg sm:text-xl font-mono font-black leading-tight block">
                {totalReportsRelayed} Relayed
              </span>
              <span className="text-[10px] text-blue-400 font-bold block truncate">
                Resident BLE Ingestion
              </span>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar: Circular Pills */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              ALL ({responders.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('AVAILABLE')}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                statusFilter === 'AVAILABLE'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                  : isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:border-emerald-500'
              }`}
            >
              AVAILABLE ({availableCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('EN_ROUTE')}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                statusFilter === 'EN_ROUTE'
                  ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-md'
                  : isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:border-[var(--accent-primary)]'
              }`}
            >
              EN ROUTE ({enRouteCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('RESTING')}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                statusFilter === 'RESTING'
                  ? 'bg-purple-500 text-white border-purple-500 shadow-md'
                  : isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:border-purple-500'
              }`}
            >
              RESTING ({restingCount})
            </button>
          </div>

          {/* Search Input Pill */}
          <div className="relative min-w-[240px]">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search call-sign, unit ID, role..."
              className={`w-full pl-9 pr-4 py-1.5 rounded-full border text-xs font-sans transition-colors focus:outline-none focus:border-[var(--accent-primary)] ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 placeholder:text-slate-400'
              }`}
            />
          </div>
        </section>

        {/* 3 Unit Cards Grid (Section with required data-testid) */}
        <section
          data-testid="responder-units-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredResponders.map((unit) => {
            const statusBadge = getStatusBadge(unit.status)
            const roleBadgeClass = getRoleBadge(unit.role)
            const fatigueInfo = getFatigueColor(unit.fatigueScore)
            const assignedIncident = INITIAL_INCIDENTS.find(
              (i) => i.id === unit.assignedIncidentId
            )

            return (
              <div
                key={unit.id}
                data-testid={`unit-card-${unit.id.toLowerCase()}`}
                className={`flex flex-col rounded-3xl border shadow-xl p-5 sm:p-6 transition-all duration-300 hover:shadow-2xl ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 shadow-slate-200/60 hover:border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-100 shadow-black/50 hover:border-[var(--accent-primary)]'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full border ${roleBadgeClass}`}>
                        {unit.role}
                      </span>
                      <span className="font-mono text-xs font-black text-[var(--accent-primary)]">
                        {unit.id}
                      </span>
                    </div>
                    <h2 className="font-heading font-black text-base sm:text-lg tracking-wide uppercase">
                      {unit.name}
                    </h2>
                  </div>

                  {/* Operational Status Pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider shrink-0 ${statusBadge.style}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                    {statusBadge.label}
                  </span>
                </div>

                {/* Fatigue Index Meter Section */}
                <div
                  className={`p-3.5 rounded-2xl border mb-4 space-y-2 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/30 border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-heading font-black text-[11px] tracking-wider uppercase text-[var(--text-secondary)]">
                      Fatigue Score
                    </span>
                    <span className={`font-mono font-black text-xs ${fatigueInfo.text}`}>
                      {unit.fatigueScore}% &bull; {fatigueInfo.label}
                    </span>
                  </div>

                  {/* Horizontal Fatigue Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${fatigueInfo.bar}`}
                      style={{ width: `${Math.min(100, unit.fatigueScore)}%` }}
                    />
                  </div>
                </div>

                {/* Hardware & Diagnostic Tiles (2x2 Grid) */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {/* Battery */}
                  <div
                    className={`p-2.5 rounded-2xl border ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[var(--accent-primary)] mb-1">
                      <Battery size={14} />
                      <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)]">
                        Battery
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black block">
                      {unit.batteryPercent}% ({unit.batteryVoltage.toFixed(2)}V)
                    </span>
                  </div>

                  {/* GPS Accuracy */}
                  <div
                    className={`p-2.5 rounded-2xl border ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[var(--accent-primary)] mb-1">
                      <Crosshair size={14} />
                      <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)]">
                        GPS Accuracy
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black block">
                      &plusmn;{unit.location.accuracyMeters.toFixed(1)}m (Kalman)
                    </span>
                  </div>

                  {/* Terminal Hardware */}
                  <div
                    className={`p-2.5 rounded-2xl border ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[var(--accent-primary)] mb-1">
                      <Radio size={14} />
                      <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)]">
                        LoRa Mesh
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black block truncate">
                      T-Beam 915MHz
                    </span>
                  </div>

                  {/* BLE Ingestion */}
                  <div
                    className={`p-2.5 rounded-2xl border ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[var(--accent-primary)] mb-1">
                      <Cpu size={14} />
                      <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-secondary)]">
                        Reports Relayed
                      </span>
                    </div>
                    <span className="font-mono text-xs font-black block">
                      {unit.relayedReportsCount} Packets
                    </span>
                  </div>
                </div>

                {/* Active Assignment Snippet */}
                <div className="mb-5 flex-1">
                  {assignedIncident ? (
                    <div
                      className={`p-3.5 rounded-2xl border space-y-1 ${
                        isLight
                          ? 'bg-orange-50/50 border-orange-200'
                          : 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase font-bold text-[var(--accent-primary)]">
                          Assigned Incident: {assignedIncident.id}
                        </span>
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                          {assignedIncident.urgency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold truncate">
                        <MapPin size={12} className="text-[var(--accent-primary)] shrink-0" />
                        <span className="truncate">{assignedIncident.location.name}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-3 rounded-2xl border text-xs text-[var(--text-secondary)] flex items-center justify-between ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-base)]/40 border-[var(--border-subtle)]'
                      }`}
                    >
                      <span>Staging Area Standby</span>
                      <span className="font-mono text-[10px] text-emerald-500 font-bold">Ready</span>
                    </div>
                  )}
                </div>

                {/* Commander Actions (Circular Pills) */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-[var(--border-subtle)]/60">
                  {/* Mandatory Rest Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleRest(unit.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                      unit.status === 'RESTING'
                        ? 'bg-purple-500 text-white border-purple-500 hover:bg-purple-600'
                        : isLight
                          ? 'bg-slate-100 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-600 border-slate-300'
                          : 'bg-[var(--bg-surface-elevated)] hover:bg-purple-900/40 hover:border-purple-500 text-slate-200 hover:text-purple-300 border-[var(--border-subtle)]'
                    }`}
                  >
                    <Coffee size={13} />
                    <span>{unit.status === 'RESTING' ? 'Resume Duty' : 'Force Rest'}</span>
                  </button>

                  {/* Inspect Telemetry */}
                  <button
                    type="button"
                    onClick={() => setInspectingUnit(unit)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full border text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-focus)] text-slate-200 border-[var(--border-subtle)]'
                    }`}
                  >
                    <SlidersHorizontal size={13} />
                    <span>Telemetry</span>
                  </button>

                  {/* Locate on Map Button */}
                  {onSelectScreen && (
                    <button
                      type="button"
                      onClick={() => onSelectScreen('command-map')}
                      title="Locate unit on Command Map"
                      aria-label={`Locate ${unit.name} on map`}
                      className="p-2 rounded-full bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shrink-0"
                    >
                      <MapPin size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {/* Empty State if filter yields no units */}
        {filteredResponders.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-[var(--border-subtle)] space-y-3">
            <Filter size={32} className="text-[var(--accent-primary)] opacity-60" />
            <h3 className="font-heading font-black text-base uppercase tracking-wider">
              No Field Responders Found
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              No units match your current status filter and search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL')
                setSearchQuery('')
              }}
              className="px-4 py-2 rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Detailed Unit Telemetry Inspector Modal */}
      {inspectingUnit && (
        <UnitInspectorModal
          unit={inspectingUnit}
          assignedIncident={
            INITIAL_INCIDENTS.find((i) => i.id === inspectingUnit.assignedIncidentId) || null
          }
          onClose={() => setInspectingUnit(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateFatigue={handleUpdateFatigue}
        />
      )}
    </div>
  )
}

export default FleetManagementScreen
