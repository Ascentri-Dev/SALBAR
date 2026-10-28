import { useState, useRef, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Minimize2, Sun, Moon } from 'lucide-react'
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
  const { theme, isMapDark, toggleMapDark } = useTheme()
  const isLight = theme === 'light'

  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS)
  const [responders, setResponders] = useState<FieldResponder[]>(INITIAL_RESPONDERS)
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null)
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('ALL')

  const [mapTileType, setMapTileType] = useState<MapTileType>('standard')
  const [isKpiOpen, setIsKpiOpen] = useState(true)
  const [isControlsOpen, setIsControlsOpen] = useState(true)
  const [isQueueOpen, setIsQueueOpen] = useState(true)
  const [isFocusMode, setIsFocusMode] = useState(false)

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
      setIsKpiOpen(true)
      setIsControlsOpen(true)
      setIsQueueOpen(true)
    } else {
      setIsFocusMode(true)
      setIsKpiOpen(false)
      setIsQueueOpen(false)
      setIsControlsOpen(true)
    }
  }, [isFocusMode])

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
        {/* 2.a Left Panel: Staggered Animated Vertically Stacked Circular Pill KPI Filter */}
        <AnimatePresence>
          {isKpiOpen && !isFocusMode && (
            <div className="pointer-events-auto absolute left-3 sm:left-5 top-20 z-20">
              <KPIStrip
                incidents={incidents}
                activeFilter={kpiFilter}
                onFilterChange={setKpiFilter}
                onClose={() => setIsKpiOpen(false)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Reveal KPI Filter Button when Minimized: Circular Pill Enclosing the word "METRICS" */}
        <AnimatePresence>
          {!isKpiOpen && !isFocusMode && (
            <motion.button
              initial={{ x: -20, opacity: 0, scale: 0.92 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: -20, opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              type="button"
              onClick={() => setIsKpiOpen(true)}
              className={`pointer-events-auto absolute left-3 sm:left-5 top-20 z-30 flex h-11 items-center gap-2 px-4 rounded-full border shadow-2xl transition-all cursor-pointer select-none ${
                isLight
                  ? 'bg-white border-slate-300 text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] shadow-black/40'
              }`}
              title="Show Metrics"
              aria-label="Show Metrics"
            >
              <ChevronRight size={16} className="text-[var(--accent-primary)]" />
              <span className="font-heading font-black text-xs tracking-wider uppercase text-[var(--accent-primary)]">
                METRICS
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 2.b Bottom-Left: Circular Icon-Only Tactical Map Controls Dock */}
        <div
          className={`pointer-events-auto absolute bottom-4 left-3 sm:left-5 z-30 transition-all duration-500 ease-out ${
            isControlsOpen
              ? 'translate-x-0 opacity-100'
              : '-translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none'
          }`}
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
        </div>

        {/* Reveal Map Controls Button when Minimized: Circular Pill Icon Button */}
        {!isControlsOpen && (
          <button
            type="button"
            onClick={() => setIsControlsOpen(true)}
            className={`pointer-events-auto absolute left-3 sm:left-5 bottom-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border shadow-2xl transition-all cursor-pointer ${
              isLight
                ? 'bg-white border-slate-300 text-slate-800 hover:text-[var(--accent-primary)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-slate-200 hover:text-[var(--accent-primary)] shadow-black/40'
            }`}
            title="Show Map Controls"
            aria-label="Show Map Controls"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* 2.c Right Panel: Live CAD Dispatch Queue & HITL Authorization Drawer */}
        <div
          data-testid="incident-stream-panel"
          className={`pointer-events-auto absolute right-3 sm:right-5 top-20 bottom-4 z-20 w-[340px] lg:w-[400px] flex flex-col transition-transform duration-500 ease-out ${
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

        {/* Reveal Queue Button when Minimized: Circular Pill */}
        <AnimatePresence>
          {!isQueueOpen && !isFocusMode && (
            <motion.button
              initial={{ x: 20, opacity: 0, scale: 0.92 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 20, opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              type="button"
              onClick={() => setIsQueueOpen(true)}
              className={`pointer-events-auto absolute right-3 sm:right-5 top-20 z-30 flex h-11 items-center gap-2 px-4 rounded-full border shadow-2xl transition-all cursor-pointer select-none ${
                isLight
                  ? 'bg-white border-slate-300 text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] shadow-black/40'
              }`}
              title="Show Live Dispatch Queue"
              aria-label="Show Live Dispatch Queue"
            >
              <ChevronLeft size={16} className="text-[var(--accent-primary)]" />
              <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)]">
                QUEUE ({filteredIncidents.length})
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Bottom-Right Map Dark Mode Control */}
        {(!isQueueOpen || isFocusMode) && (
          <div className="pointer-events-auto absolute bottom-4 right-3 sm:right-5 z-30">
            <button
              type="button"
              onClick={toggleMapDark}
              className={`flex h-10 items-center gap-1.5 px-3 rounded-full border shadow-2xl backdrop-blur-md transition-all font-mono text-xs font-bold cursor-pointer ${
                isMapDark
                  ? 'bg-[var(--bg-surface)]/90 border-[var(--border-subtle)] text-amber-400 hover:text-white hover:bg-[var(--accent-primary)]'
                  : 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
              }`}
              title={isMapDark ? 'Map: Dark Mode (Click for Light Mode)' : 'Map: Light Mode (Click for Dark Mode)'}
              aria-label="Toggle Map Dark Mode"
            >
              {isMapDark ? <Sun size={15} /> : <Moon size={15} />}
              <span className="text-[10px] uppercase">{isMapDark ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        )}

        {/* Exit Focus Mode Floating Pill */}
        {isFocusMode && (
          <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-30">
            <button
              type="button"
              onClick={toggleFocusMode}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent-primary)] text-white text-xs font-bold uppercase tracking-wider shadow-2xl backdrop-blur-md hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              <Minimize2 size={14} />
              <span>Exit Tactical Focus</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommandMapScreen
