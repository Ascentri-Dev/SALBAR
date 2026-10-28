import { useState } from 'react'
import { X, Battery, Radio, Crosshair, Cpu, Shield, Activity, Copy, Check } from 'lucide-react'
import type { FieldResponder, IncidentReport } from '../../types/cad'
import { useTheme } from '../../context'

export interface UnitInspectorModalProps {
  unit: FieldResponder | null
  assignedIncident: IncidentReport | null
  onClose: () => void
  onUpdateStatus: (unitId: string, status: FieldResponder['status']) => void
  onUpdateFatigue: (unitId: string, fatigueScore: number) => void
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
  const [localFatigue, setLocalFatigue] = useState(unit?.fatigueScore ?? 0)

  if (!unit) return null

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${unit.location.lat.toFixed(6)}, ${unit.location.lng.toFixed(6)}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      default:
        return {
          label: 'OFFLINE',
          style: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
          dot: 'bg-slate-500',
        }
    }
  }

  const statusBadge = getStatusBadge()

  return (
    <div
      data-testid="unit-inspector-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        data-testid="unit-inspector-modal"
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-colors ${
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
                {unit.role} &bull; Last seen {unit.lastSeen}
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
              <span className="text-xs text-[var(--text-secondary)] font-bold">Commander Quick Status:</span>
              <select
                value={unit.status}
                onChange={(e) => onUpdateStatus(unit.id, e.target.value as FieldResponder['status'])}
                className={`text-xs font-bold rounded-full px-3 py-1 border transition-colors focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)] text-slate-200'
                }`}
              >
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
              <span>Current Staging: Standing by at Barangay EOC Base Camp</span>
              <span className="font-mono text-[11px] text-emerald-500 font-bold">Unassigned</span>
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
                {localFatigue}%
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
                Reset to Zero (Post-Rest)
              </button>
              <button
                type="button"
                onClick={handleSaveFatigue}
                className="px-4 py-1.5 rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                Save Fatigue Score
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
                  <span className="font-bold text-emerald-500">{unit.batteryPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Bus Voltage:</span>
                  <span className="font-bold">{unit.batteryVoltage.toFixed(2)} V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Estimated Runtime:</span>
                  <span className="font-bold">~{Math.round(unit.batteryPercent * 0.08)} hours</span>
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
                  <button
                    type="button"
                    onClick={handleCopyCoords}
                    className="flex items-center gap-1 text-[11px] font-bold text-[var(--accent-primary)] hover:underline cursor-pointer"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{unit.location.lat.toFixed(4)}, {unit.location.lng.toFixed(4)}</span>
                  </button>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Horizontal Accuracy:</span>
                  <span className="font-bold">&plusmn;{unit.location.accuracyMeters.toFixed(1)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Filter Status:</span>
                  <span className="font-bold text-cyan-400">Kalman Filter Active</span>
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
                  <span className="font-bold">{unit.terminalType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Estimated SNR / RSSI:</span>
                  <span className="font-bold text-emerald-500">+8.5 dB / -92 dBm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Mesh Routing Hops:</span>
                  <span className="font-bold">1 Hop (Direct to Gateway)</span>
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
                  <span className="font-bold text-[var(--accent-primary)]">{unit.relayedReportsCount} Packets</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">BLE Advert Status:</span>
                  <span className="font-bold text-emerald-500">Broadcasting Relay Beacon</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Mesh Sync State:</span>
                  <span className="font-bold">Synchronized</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-end shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-surface-elevated)]/60 border-[var(--border-subtle)]'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  )
}

export default UnitInspectorModal
