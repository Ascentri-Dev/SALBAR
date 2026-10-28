import { useState, useRef, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Minimize2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import L from 'leaflet'
import { TacticalMap, type MapTileType } from '../../components/map/TacticalMap'
import { KPIStrip, type KpiFilter } from '../../components/kpi/KPIStrip'
import { IncidentStreamPanel } from '../../components/stream/IncidentStreamPanel'
import { HITLDispatchDrawer } from '../../components/dispatch/HITLDispatchDrawer'
import { MapControlsDock } from '../../components/map/MapControlsDock'
import { useTheme } from '../../context'
import {
  INITIAL_INCIDENTS,
  INITIAL_RESPONDERS,
  ROAD_HAZARDS,
} from '../../data/mockCadData'
import type { IncidentReport, FieldResponder } from '../../types/cad'

export interface CommandMapScreenProps {
  className?: string
}

const DEFAULT_CENTER: [number, number] = [10.3157, 123.8854]
const DEFAULT_ZOOM = 14

export function CommandMapScreen({ className = '' }: CommandMapScreenProps) {
  const { theme, isMapDark, toggleMapDark, isNavbarOpen, setIsNavbarOpen } = useTheme()
  const isLight = theme === 'light'

  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS)
  const [responders, setResponders] = useState<FieldResponder[]>(INITIAL_RESPONDERS)
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null)
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('ALL')

  const [mapTileType, setMapTileType] = useState<MapTileType>('standard')
  const [isKpiOpen, setIsKpiOpen] = useState(false)
  const [isControlsOpen, setIsControlsOpen] = useState(true)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)

  const prevPanelStateRef = useRef({ kpi: false, queue: false })
  const mapRef = useRef<L.Map | null>(null)

  // Filter incidents based on active KPI filter
  const filteredIncidents = incidents.filter((inc) => {
    if (kpiFilter === 'ALL') return true
    if (kpiFilter === 'CRITICAL') return inc.urgency === 'CRITICAL' && inc.status !== 'RESOLVED'
    if (kpiFilter === 'ACTIVE') return inc.status === 'UNASSIGNED' || inc.status === 'PROPOSAL_PENDING'
    if (kpiFilter === 'PENDING') return inc.status === 'PROPOSAL_PENDING'
    if (kpiFilter === 'RESOLVED') return inc.status === 'RESOLVED'
    return true
  })

  // Map Controls Callbacks
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut()
  }, [])

  const handleLocate = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          mapRef.current?.flyTo(
            [position.coords.latitude, position.coords.longitude],
            15,
            { duration: 1.0 }
          )
        },
        () => {
          mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1.0 })
        }
      )
    } else {
      mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1.0 })
    }
  }, [])

  const handleToggleTileType = useCallback(() => {
    setMapTileType((prev) => (prev === 'standard' ? 'humanitarian' : 'standard'))
  }, [])

  const toggleFocusMode = useCallback(() => {
    if (isFocusMode) {
      setIsFocusMode(false)
      setIsNavbarOpen(true)
      setIsKpiOpen(prevPanelStateRef.current.kpi)
      setIsControlsOpen(true)
      setIsQueueOpen(prevPanelStateRef.current.queue)
    } else {
      prevPanelStateRef.current = { kpi: isKpiOpen, queue: isQueueOpen }
      setIsFocusMode(true)
      setIsNavbarOpen(false)
      setIsKpiOpen(false)
      setIsControlsOpen(false)
      setIsQueueOpen(false)
    }
  }, [isFocusMode, isKpiOpen, isQueueOpen, setIsNavbarOpen])

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
          selectedIncidentId={selectedIncident ? selectedIncident.id : null}
          onSelectIncident={(incidentId) => {
            const found = incidents.find((i) => i.id === incidentId)
            if (found) {
              setSelectedIncident(found)
              setIsQueueOpen(true)
            }
          }}
          onApproveDispatch={handleApproveDispatch}
          mapTileType={mapTileType}
          isMapDark={isMapDark}
          mapRef={mapRef}
        />
      </div>

      {/* 2. Floating Overlays (Z-20) */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {/* 2.a Left Panel: KPI Filter / Trigger (Active only when Queue is open on the right) */}
        {isQueueOpen && !isFocusMode && (
          <AnimatePresence mode="wait">
            {isKpiOpen ? (
              <motion.div
                key="left-kpi-strip"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto absolute left-3 sm:left-5 top-20 z-20"
              >
                <KPIStrip
                  incidents={incidents}
                  activeFilter={kpiFilter}
                  onFilterChange={setKpiFilter}
                  onClose={() => setIsKpiOpen(false)}
                  align="left"
                />
              </motion.div>
            ) : (
              <motion.button
                key="left-kpi-pill"
                initial={{ x: -20, opacity: 0, scale: 0.92 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: -20, opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                type="button"
                onClick={() => setIsKpiOpen(true)}
                className={`pointer-events-auto absolute left-3 sm:left-5 top-20 z-30 flex h-9.5 w-[130px] items-center justify-center gap-2 rounded-full border shadow-2xl transition-all cursor-pointer select-none active:scale-95 ${
                  isLight
                    ? 'bg-white border-slate-300 text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] shadow-black/40'
                }`}
                title="Show Metrics"
                aria-label="Show Metrics"
              >
                <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)]">
                  METRICS
                </span>
                <ChevronRight size={14} className="text-[var(--accent-primary)] shrink-0" />
              </motion.button>
            )}
          </AnimatePresence>
        )}

        {/* 2.b Bottom-Left: Tactical Map Controls Dock or Minimized / Focus Action */}
        <div className="pointer-events-auto absolute bottom-4 left-3 sm:left-5 z-30 h-13 sm:h-14 flex items-center">
          <AnimatePresence mode="wait">
            {isFocusMode ? (
              <motion.button
                key="focus-mode-toggle"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                type="button"
                onClick={toggleFocusMode}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-[var(--accent-primary)] text-white shadow-2xl hover:bg-[var(--accent-hover)] transition-all cursor-pointer active:scale-95"
                title="Exit Focus Mode (Return to Normal)"
                aria-label="Exit Focus Mode"
              >
                <Minimize2 size={18} />
              </motion.button>
            ) : !isControlsOpen ? (
              <motion.button
                key="controls-reveal-toggle"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                type="button"
                onClick={() => setIsControlsOpen(true)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border shadow-2xl transition-all cursor-pointer active:scale-95 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-200 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] shadow-black/40'
                }`}
                title="Show Map Controls"
                aria-label="Show Map Controls"
              >
                <ChevronRight size={18} />
              </motion.button>
            ) : (
              <motion.div
                key="controls-dock-container"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <MapControlsDock
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onLocate={handleLocate}
                  mapTileType={mapTileType}
                  onToggleTileType={handleToggleTileType}
                  isMapDark={isMapDark}
                  onToggleMapDark={toggleMapDark}
                  isFocusMode={isFocusMode}
                  onToggleFocusMode={toggleFocusMode}
                  onClose={() => setIsControlsOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2.c Right Panel: Live CAD Dispatch Queue & HITL Authorization Drawer */}
        <div
          data-testid="incident-stream-panel"
          className={`pointer-events-auto absolute right-3 sm:right-5 ${
            isNavbarOpen ? 'top-20' : 'top-3 sm:top-4'
          } bottom-4 z-20 w-[340px] lg:w-[400px] flex flex-col transition-all duration-300 ease-out ${
            isQueueOpen && !isFocusMode
              ? 'translate-x-0 opacity-100'
              : 'translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none'
          }`}
        >
          <div className="relative h-full flex flex-col min-h-0 gap-2.5">
            {/* Top segment: Live Queue Feed with Circular Pill Styling */}
            <div
              className={`transition-all duration-300 overflow-hidden ${
                selectedIncident ? 'h-1/2 min-h-[220px]' : 'h-full'
              }`}
            >
              <IncidentStreamPanel
                incidents={filteredIncidents}
                selectedIncident={selectedIncident}
                onSelectIncident={(inc) => {
                  setSelectedIncident(inc)
                  setIsQueueOpen(true)
                }}
                onClose={() => setIsQueueOpen(false)}
              />
            </div>

            {/* Bottom segment: HITL Dispatch Authorization Drawer */}
            {selectedIncident && (
              <div className="h-1/2 min-h-[260px] overflow-hidden">
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
          </div>
        </div>

        {/* Right Stack: Uniform Pills (Queue + Metrics) or Expanded Right KPI Strip when Queue is Untoggled */}
        <AnimatePresence>
          {!isQueueOpen && !isFocusMode && (
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-none absolute right-3 sm:right-5 ${
                isNavbarOpen ? 'top-20' : 'top-3 sm:top-4'
              } z-30 flex flex-col gap-2.5 items-end transition-all duration-300`}
            >
              {/* Queue Reveal Button: Compact Pill */}
              <button
                type="button"
                onClick={() => setIsQueueOpen(true)}
                className={`pointer-events-auto flex h-9.5 w-[130px] items-center justify-center gap-2 rounded-full border shadow-2xl transition-all cursor-pointer select-none active:scale-95 ${
                  isLight
                    ? 'bg-white border-slate-300 text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] shadow-black/40'
                }`}
                title="Show Live Dispatch Queue"
                aria-label="Show Live Dispatch Queue"
              >
                <ChevronLeft size={14} className="text-[var(--accent-primary)] shrink-0" />
                <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)]">
                  QUEUE ({filteredIncidents.length})
                </span>
              </button>

              {/* Metrics on the Right (Untoggled Compact Pill or Expanded Right Strip) */}
              <AnimatePresence mode="wait">
                {!isKpiOpen ? (
                  <motion.button
                    key="right-kpi-pill"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    type="button"
                    onClick={() => setIsKpiOpen(true)}
                    className={`pointer-events-auto flex h-9.5 w-[130px] items-center justify-center gap-2 rounded-full border shadow-2xl transition-all cursor-pointer select-none active:scale-95 ${
                      isLight
                        ? 'bg-white border-slate-300 text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] shadow-black/40'
                    }`}
                    title="Show Metrics"
                    aria-label="Show Metrics"
                  >
                    <ChevronLeft size={14} className="text-[var(--accent-primary)] shrink-0" />
                    <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)]">
                      METRICS
                    </span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="right-kpi-strip"
                    initial={{ x: 35, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 35, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="pointer-events-auto"
                  >
                    <KPIStrip
                      incidents={incidents}
                      activeFilter={kpiFilter}
                      onFilterChange={setKpiFilter}
                      onClose={() => setIsKpiOpen(false)}
                      align="right"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default CommandMapScreen
