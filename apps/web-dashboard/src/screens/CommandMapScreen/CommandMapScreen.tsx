import { useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { TacticalMap } from '../../components/map/TacticalMap'
import { KPIStrip, type KpiFilter } from '../../components/kpi/KPIStrip'
import { IncidentStreamPanel } from '../../components/stream/IncidentStreamPanel'
import { HITLDispatchDrawer } from '../../components/dispatch/HITLDispatchDrawer'
import { AISitRepPanel } from '../../components/sitrep/AISitRepPanel'
import {
  INITIAL_INCIDENTS,
  INITIAL_RESPONDERS,
  ROAD_HAZARDS,
} from '../../data/mockCadData'
import type { IncidentReport, FieldResponder } from '../../types/cad'

export interface CommandMapScreenProps {
  className?: string
}

export function CommandMapScreen({ className = '' }: CommandMapScreenProps) {
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS)
  const [responders, setResponders] = useState<FieldResponder[]>(INITIAL_RESPONDERS)
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null)
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('ALL')

  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isLeftPanelMinimized, setIsLeftPanelMinimized] = useState(false)
  const [isRightPanelMinimized, setIsRightPanelMinimized] = useState(false)

  // Filter incidents based on active KPI filter
  const filteredIncidents = incidents.filter((inc) => {
    if (kpiFilter === 'ALL') return true
    if (kpiFilter === 'CRITICAL') return inc.urgency === 'CRITICAL' && inc.status !== 'RESOLVED'
    if (kpiFilter === 'ACTIVE') return inc.status === 'UNASSIGNED' || inc.status === 'PROPOSAL_PENDING'
    if (kpiFilter === 'PENDING') return inc.status === 'PROPOSAL_PENDING'
    if (kpiFilter === 'RESOLVED') return inc.status === 'RESOLVED'
    return true
  })

  // Approve dispatch action
  const handleApproveDispatch = (incidentId: string, unitId: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status: 'DISPATCHED',
              assignedUnitId: unitId,
              dispatchedAt: new Date().toLocaleTimeString(),
            }
          : inc
      )
    )

    setResponders((prev) =>
      prev.map((r) =>
        r.id === unitId
          ? {
              ...r,
              status: 'EN_ROUTE',
              assignedIncidentId: incidentId,
              fatigueScore: Math.min(100, r.fatigueScore + 15),
            }
          : r
      )
    )

    if (selectedIncident && selectedIncident.id === incidentId) {
      setSelectedIncident((prev) =>
        prev
          ? {
              ...prev,
              status: 'DISPATCHED',
              assignedUnitId: unitId,
            }
          : null
      )
    }
  }

  // Reject proposal action
  const handleRejectProposal = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId ? { ...inc, status: 'UNASSIGNED' } : inc
      )
    )
    if (selectedIncident?.id === incidentId) {
      setSelectedIncident(null)
    }
  }

  return (
    <div
      data-testid="screen-command-map"
      className={`relative w-full h-full flex-1 overflow-hidden select-none bg-[var(--bg-base)] ${className}`.trim()}
    >
      {/* 1. Base Layer: Full-Viewport Tactical GIS Map */}
      <div data-testid="gis-map-container" className="absolute inset-0 z-0 w-full h-full">
        <TacticalMap
          incidents={filteredIncidents}
          responders={responders}
          hazards={ROAD_HAZARDS}
          selectedIncident={selectedIncident}
          onSelectIncident={(inc) => {
            setSelectedIncident(inc)
            setIsRightPanelMinimized(false)
          }}
        />
      </div>

      {/* 2. Floating Command HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {/* Top: Floating Skewed KPI Strip */}
        <div
          className={`pointer-events-auto absolute left-2 right-2 md:left-4 md:right-4 z-20 transition-all duration-300 ease-in-out ${
            isFocusMode ? '-top-24 opacity-0 pointer-events-none' : 'top-3 opacity-100'
          }`}
        >
          <KPIStrip
            incidents={incidents}
            activeFilter={kpiFilter}
            onFilterChange={setKpiFilter}
          />
        </div>

        {/* Left Floating Panel: AI Situation Report (SitRep) */}
        <div
          className={`pointer-events-auto absolute left-2 md:left-4 bottom-14 top-18 z-20 w-[290px] lg:w-[320px] transition-transform duration-300 ease-out ${
            isLeftPanelMinimized || isFocusMode
              ? '-translate-x-[calc(100%+1.5rem)]'
              : 'translate-x-0'
          }`}
        >
          <div className="relative h-full">
            <AISitRepPanel
              incidents={incidents}
              responders={responders}
              hazards={ROAD_HAZARDS}
              onFocusIncident={(inc) => {
                setSelectedIncident(inc)
                setIsRightPanelMinimized(false)
              }}
            />

            {/* Minimize button */}
            <button
              type="button"
              onClick={() => setIsLeftPanelMinimized(true)}
              title="Minimize SitRep"
              className="absolute -right-7 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-r border border-l-0 border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        {/* Restore Left Button (When Minimized) */}
        {!isFocusMode && isLeftPanelMinimized && (
          <button
            type="button"
            onClick={() => setIsLeftPanelMinimized(false)}
            title="Expand SitRep"
            className="pointer-events-auto absolute left-0 top-20 z-20 flex h-8 px-2.5 items-center gap-1 rounded-r border border-l-0 border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 text-xs font-mono font-bold text-[var(--accent-primary)] shadow-lg backdrop-blur-md hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
          >
            <span>SITREP</span>
            <ChevronRight size={14} />
          </button>
        )}

        {/* Right Floating Panel: Live CAD Feed & HITL Dispatch Drawer */}
        <div
          data-testid="incident-stream-panel"
          className={`pointer-events-auto absolute right-2 md:right-4 bottom-14 top-18 z-20 w-[340px] lg:w-[400px] flex flex-col transition-transform duration-300 ease-out ${
            isRightPanelMinimized || isFocusMode
              ? 'translate-x-[calc(100%+1.5rem)]'
              : 'translate-x-0'
          }`}
        >
          <div className="relative h-full flex flex-col min-h-0">
            {/* Top half or main feed */}
            <div className={`transition-all duration-300 ${selectedIncident ? 'h-1/2' : 'h-full'}`}>
              <IncidentStreamPanel
                incidents={filteredIncidents}
                selectedIncident={selectedIncident}
                onSelectIncident={(inc) => setSelectedIncident(inc)}
                isMinimized={isRightPanelMinimized}
                onToggleMinimize={() => setIsRightPanelMinimized(true)}
              />
            </div>

            {/* Bottom half: HITL Dispatch Drawer when incident selected */}
            {selectedIncident && (
              <div className="h-1/2 min-h-0">
                <HITLDispatchDrawer
                  key={selectedIncident.id}
                  incident={selectedIncident}
                  responders={responders}
                  onApproveDispatch={handleApproveDispatch}
                  onRejectProposal={handleRejectProposal}
                  onClose={() => setSelectedIncident(null)}
                />
              </div>
            )}

            {/* Minimize right button */}
            <button
              type="button"
              onClick={() => setIsRightPanelMinimized(true)}
              title="Minimize CAD Feed"
              className="absolute -left-7 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-l border border-r-0 border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Restore Right Button (When Minimized) */}
        {!isFocusMode && isRightPanelMinimized && (
          <button
            type="button"
            onClick={() => setIsRightPanelMinimized(false)}
            title="Expand CAD Feed"
            className="pointer-events-auto absolute right-0 top-20 z-20 flex h-8 px-2.5 items-center gap-1 rounded-l border border-r-0 border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 text-xs font-mono font-bold text-[var(--accent-primary)] shadow-lg backdrop-blur-md hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
          >
            <ChevronLeft size={14} />
            <span>CAD FEED ({filteredIncidents.length})</span>
          </button>
        )}

        {/* Bottom Center: FOCUS Mode Toggle Button */}
        <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <button
            type="button"
            onClick={() => setIsFocusMode((prev) => !prev)}
            aria-label="Toggle Tactical Focus Mode"
            className={`flex h-9 items-center justify-center gap-1.5 rounded-sm border px-3.5 shadow-xl backdrop-blur-md transition-all font-mono text-xs font-bold tracking-wider cursor-pointer -skew-x-12 ${
              isFocusMode
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/50'
                : 'bg-[var(--bg-surface)]/90 text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <span className="skew-x-12 inline-flex items-center gap-1.5">
              {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFocusMode ? 'EXIT FOCUS' : 'FOCUS MAP'}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default CommandMapScreen
