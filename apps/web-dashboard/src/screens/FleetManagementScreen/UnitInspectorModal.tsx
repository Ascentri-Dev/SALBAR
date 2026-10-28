import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Battery, Radio, Crosshair, Cpu, Shield, Activity, Copy, Check } from 'lucide-react'
import type { IncidentReport, ResponderStatus } from '../../types/cad'
import { useTheme } from '../../context'

export interface FleetResponderUnit {
  id: string
  name: string
  role: 'Search and Rescue' | 'Damage Assessment' | 'Relief Operations'
  status: ResponderStatus | 'N/A'
  batteryPercent: number | null
  batteryVoltage: number | null
  fatigueScore: number | null
  location: {
    lat: number | null
    lng: number | null
    accuracyMeters: number | null
    kalmanFiltered: boolean
  }
  assignedIncidentId?: string | null
  lastSeen?: string | null
  relayedReportsCount: number | null
  terminalType?: string | null
}

export interface UnitInspectorModalProps {
  unit: FleetResponderUnit | null
  assignedIncident: IncidentReport | null
  onClose: () => void
  onUpdateStatus: (unitId: string, status: ResponderStatus | 'N/A') => void
  onUpdateFatigue: (unitId: string, fatigueScore: number | null) => void
}

export function UnitInspectorModal({
  unit,
  assignedIncident,
  onClose,
  onUpdateStatus,
  onUpdateFatigue,
}: UnitInspectorModalProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [copied, setCopied] = useState(false)
  const [localFatigue, setLocalFatigue] = useState<number>(unit?.fatigueScore ?? 0)

  if (!unit) return null

  const handleCopyCoords = () => {
    if (unit.location.lat !== null && unit.location.lng !== null) {
      navigator.clipboard.writeText(`${unit.location.lat.toFixed(6)}, ${unit.location.lng.toFixed(6)}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSaveFatigue = () => {
    onUpdateFatigue(unit.id, localFatigue)
  }

  const handleResetFatigue = () => {
    setLocalFatigue(0)
    onUpdateFatigue(unit.id, 0)
  }

  const getStatusBadge = () => {
    switch (unit.status) {
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
          label: 'RESTING / MANDATORY BREAK',
          style: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
          dot: 'bg-purple-500',
        }
      case 'OFFLINE':
        return {
          label: 'OFFLINE',
          style: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
          dot: 'bg-slate-500',
        }
      default:
        return {
          label: 'N/A',
          style: 'bg-slate-500/10 text-[var(--text-secondary)] border-slate-300 dark:border-slate-700',
          dot: 'bg-slate-400',
        }
    }
  }

  const statusBadge = getStatusBadge()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      data-testid="unit-inspector-backdrop"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        data-testid="unit-inspector-modal"
        className={`w-full max-w-2xl max-h-[85vh] my-auto flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
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
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-base sm:text-lg uppercase tracking-wide truncate">
                  {unit.name}
                </h3>
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[var(--accent-primary)]">
                  {unit.id}
                </span>
              </div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                {unit.role} &bull; Last seen: {unit.lastSeen ?? 'N/A'}
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
            title="Close Inspector"
            aria-label="Close Inspector"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto salbar-scrollbar flex-1 font-sans">
          {/* Status and Active Assignment */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-black tracking-wider uppercase ${statusBadge.style}`}>
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                {statusBadge.label}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] font-bold">Commander Status:</span>
              <select
                value={unit.status}
                onChange={(e) => onUpdateStatus(unit.id, e.target.value as ResponderStatus | 'N/A')}
                className={`text-xs font-bold rounded-full px-3 py-1 border transition-colors focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-slate-200'
                }`}
              >
                <option value="N/A">N/A (Unset)</option>
                <option value="AVAILABLE">Available</option>
                <option value="EN_ROUTE">En Route</option>
                <option value="ON_SCENE">On Scene</option>
                <option value="RESTING">Resting</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </div>
          </div>

          {/* Active Incident Banner if dispatched */}
          {assignedIncident ? (
            <div
              className={`p-4 rounded-2xl border space-y-2 ${
                isLight
                  ? 'bg-orange-50/70 border-orange-200 text-slate-900'
                  : 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)]">
                  Active Mission Assignment: {assignedIncident.id}
                </span>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                  {assignedIncident.urgency}
                </span>
              </div>
              <p className="text-xs font-semibold">
                Destination: {assignedIncident.location.name}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">
                "{assignedIncident.aiBriefing}"
              </p>
            </div>
          ) : (
            <div
              className={`p-3.5 rounded-2xl border text-xs text-[var(--text-secondary)] flex items-center justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-base)]/50 border-[var(--border-subtle)]'
              }`}
            >
              <span>Current Staging: N/A (Awaiting Backend Sync)</span>
              <span className="font-mono text-[11px] text-[var(--text-secondary)] font-bold">N/A</span>
            </div>
          )}

          {/* Fatigue Management & Calibration Section */}
          <div
            className={`p-4 rounded-2xl border space-y-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/30 border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[var(--accent-primary)]" />
                <span className="font-heading font-black text-xs uppercase tracking-wider">
                  Responder Fatigue Calibration
                </span>
              </div>
              <span className="font-mono font-black text-sm text-[var(--accent-primary)]">
                {unit.fatigueScore !== null ? `${localFatigue}%` : 'N/A'}
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-1.5">
              <input
                type="range"
                min="0"
                max="100"
                value={localFatigue}
                onChange={(e) => setLocalFatigue(Number(e.target.value))}
                className="w-full accent-[var(--accent-primary)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[var(--text-secondary)]">
                <span>0% (Rested)</span>
                <span>50% (Moderate)</span>
                <span>100% (Exhaustion)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleResetFatigue}
                className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-300 hover:bg-[var(--border-subtle)]'
                }`}
              >
                Reset to Zero
              </button>
              <button
                type="button"
                onClick={handleSaveFatigue}
                className="px-4 py-1.5 rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Save Score
              </button>
            </div>
          </div>

          {/* Detailed Hardware Diagnostics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Battery & Power */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/40 border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <Battery size={16} />
                <span className="font-heading font-black text-xs uppercase tracking-wider">
                  Power & Battery (AXP192)
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Charge Level:</span>
                  <span className="font-bold text-[var(--text-secondary)]">
                    {unit.batteryPercent !== null ? `${unit.batteryPercent}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Bus Voltage:</span>
                  <span className="font-bold">
                    {unit.batteryVoltage !== null ? `${unit.batteryVoltage.toFixed(2)} V` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Estimated Runtime:</span>
                  <span className="font-bold">N/A</span>
                </div>
              </div>
            </div>

            {/* GPS Telemetry */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/40 border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <Crosshair size={16} />
                <span className="font-heading font-black text-xs uppercase tracking-wider">
                  GPS & Positioning
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Coordinates:</span>
                  {unit.location.lat !== null && unit.location.lng !== null ? (
                    <button
                      type="button"
                      onClick={handleCopyCoords}
                      className="flex items-center gap-1 text-[11px] font-bold text-[var(--accent-primary)] hover:underline cursor-pointer"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{unit.location.lat.toFixed(4)}, {unit.location.lng.toFixed(4)}</span>
                    </button>
                  ) : (
                    <span className="font-bold text-[var(--text-secondary)]">N/A</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Horizontal Accuracy:</span>
                  <span className="font-bold">
                    {unit.location.accuracyMeters !== null ? `\u00B1${unit.location.accuracyMeters.toFixed(1)} m` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Filter Status:</span>
                  <span className="font-bold text-[var(--text-secondary)]">N/A</span>
                </div>
              </div>
            </div>

            {/* LoRa Mesh Radio Link */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/40 border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <Radio size={16} />
                <span className="font-heading font-black text-xs uppercase tracking-wider">
                  LoRa 915 MHz Mesh Link
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Hardware Terminal:</span>
                  <span className="font-bold">{unit.terminalType ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Estimated SNR / RSSI:</span>
                  <span className="font-bold text-[var(--text-secondary)]">N/A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Mesh Routing Hops:</span>
                  <span className="font-bold">N/A</span>
                </div>
              </div>
            </div>

            {/* BLE Ingestion Metrics */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/40 border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <Cpu size={16} />
                <span className="font-heading font-black text-xs uppercase tracking-wider">
                  Civilian BLE Relay
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Ingested Reports:</span>
                  <span className="font-bold text-[var(--text-secondary)]">
                    {unit.relayedReportsCount !== null ? `${unit.relayedReportsCount} Packets` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">BLE Advert Status:</span>
                  <span className="font-bold text-[var(--text-secondary)]">N/A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Mesh Sync State:</span>
                  <span className="font-bold">N/A</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default UnitInspectorModal
