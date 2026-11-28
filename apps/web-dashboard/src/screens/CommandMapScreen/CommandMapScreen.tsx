import { useState, useRef, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
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
import { useGatewayBridge, type LiveTelemetryUpdate } from '../../hooks/useGatewayBridge'

export interface CommandMapScreenProps {
  incidents?: IncidentReport[]
  setIncidents?: Dispatch<SetStateAction<IncidentReport[]>>
  responders?: FieldResponder[]
  setResponders?: Dispatch<SetStateAction<FieldResponder[]>>
  sendDispatch?: (targetUnit: string, incidentId: string, notes?: string) => void
  className?: string
}

const DEFAULT_CENTER: [number, number] = [10.3157, 123.8854]
const DEFAULT_ZOOM = 14

const kpiStripWrapperVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { when: 'afterChildren' as const, duration: 0.15 },
  },
}

export function CommandMapScreen({
  incidents: externalIncidents,
  setIncidents: externalSetIncidents,
  responders: externalResponders,
  setResponders: externalSetResponders,
  sendDispatch: externalSendDispatch,
  className = '',
}: CommandMapScreenProps) {
  const { theme, isMapDark, toggleMapDark, isNavbarOpen, setIsNavbarOpen } = useTheme()
  const isLight = theme === 'light'

  const [localIncidents, setLocalIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS)
  const [localResponders, setLocalResponders] = useState<FieldResponder[]>(INITIAL_RESPONDERS)

  const incidents = externalIncidents ?? localIncidents
  const setIncidents = externalSetIncidents ?? setLocalIncidents
  const responders = externalResponders ?? localResponders
  const setResponders = externalSetResponders ?? setLocalResponders

  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null)
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('ALL')
  const hasAutoCenteredRef = useRef(false)

  // Auto-center map on first live responder fix when coordinates arrive
  useEffect(() => {
    if (hasAutoCenteredRef.current || !mapRef.current) return
    const fixed = responders.find((r) => !(r.location.lat === 0 && r.location.lng === 0))
    if (fixed) {
      mapRef.current.flyTo([fixed.location.lat, fixed.location.lng], 15, { duration: 1.0 })
      hasAutoCenteredRef.current = true
    }
  }, [responders])

  // Standalone fallback bridge only when CommandMapScreen is mounted without App-level state
  const handleLiveTelemetry = useCallback(
    (telemetry: LiveTelemetryUpdate) => {
      if (externalSetResponders) return
      setLocalResponders((prev) => {
        const exists = prev.some((r) => r.id === telemetry.id)
        if (!exists) {
          const newUnit: FieldResponder = {
            id: telemetry.id,
            name: `Unit ${telemetry.id}`,
            role: 'Search and Rescue',
            terminalType: 'TTGO_T_BEAM_V12',
            status: telemetry.status || 'AVAILABLE',
            batteryPercent: telemetry.batteryPercent ?? 90,
            batteryVoltage: telemetry.batteryVoltage ?? 4.0,
            fatigueScore: telemetry.fatigueScore ?? 10,
            location: {
              lat: telemetry.lat ?? 0,
              lng: telemetry.lng ?? 0,
              accuracyMeters: telemetry.accuracyMeters ?? 0,
              kalmanFiltered: telemetry.kalmanFiltered ?? false,
              gpsFix: telemetry.gpsFix ?? telemetry.lat !== undefined,
              satellites: telemetry.satellites,
              satellitesInView: telemetry.satellitesInView,
              gpsModuleOk: telemetry.gpsModuleOk,
            },
            lastSeen: 'Just now',
            relayedReportsCount: telemetry.relayedReportsCount ?? 0,
          }
          return [...prev, newUnit]
        }
        return prev.map((r) => {
          if (r.id !== telemetry.id) return r
          return {
            ...r,
            ...telemetry,
            location: {
              ...r.location,
              ...(telemetry.lat !== undefined && telemetry.lng !== undefined
                ? {
                    lat: telemetry.lat,
                    lng: telemetry.lng,
                    accuracyMeters: telemetry.accuracyMeters ?? r.location.accuracyMeters,
                    kalmanFiltered: telemetry.kalmanFiltered ?? r.location.kalmanFiltered,
                  }
                : {}),
              gpsFix: telemetry.gpsFix ?? r.location.gpsFix,
              satellites: telemetry.satellites ?? r.location.satellites,
              satellitesInView: telemetry.satellitesInView ?? r.location.satellitesInView,
              gpsModuleOk: telemetry.gpsModuleOk ?? r.location.gpsModuleOk,
            },
            lastSeen: 'Just now',
          }
        })
      })
    },
    [externalSetResponders]
  )

  const handleLiveIncident = useCallback(
    (incomingInc: IncidentReport) => {
      if (externalSetIncidents) return
      setLocalIncidents((prev) => {
        if (prev.some((i) => i.id === incomingInc.id)) return prev
        return [incomingInc, ...prev]
      })
      setKpiFilter('ALL')
      if (incomingInc.location?.lat && incomingInc.location?.lng && mapRef.current) {
        mapRef.current.flyTo([incomingInc.location.lat, incomingInc.location.lng], 16, { duration: 1.0 })
      }
    },
    [externalSetIncidents]
  )

  const { sendDispatch: localSendDispatch } = useGatewayBridge(
    externalSetResponders ? undefined : handleLiveTelemetry,
    externalSetIncidents ? undefined : handleLiveIncident
  )
  const sendDispatch = externalSendDispatch ?? localSendDispatch

  const [mapTileType, setMapTileType] = useState<MapTileType>('standard')
  const [isKpiOpen, setIsKpiOpen] = useState(false)
  const [isControlsOpen, setIsControlsOpen] = useState(true)
  const [isGpsStatusOpen, setIsGpsStatusOpen] = useState(true)
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)

  const acquiringResponders = responders.filter((r) => r.location.gpsFix === false)

  const prevPanelStateRef = useRef({ kpi: false, queue: false })
  const mapRef = useRef<L.Map | null>(null)

  // Filter incidents based on active KPI filter
  const filteredIncidents = incidents.filter((inc) => {
    if (kpiFilter === 'ALL' || kpiFilter === 'DEVICES') return true
    if (kpiFilter === 'CRITICAL') return inc.urgency === 'CRITICAL' && inc.status !== 'RESOLVED'
    if (kpiFilter === 'ACTIVE') return inc.status === 'UNASSIGNED' || inc.status === 'PROPOSAL_PENDING'
    if (kpiFilter === 'PENDING') return inc.status === 'PROPOSAL_PENDING'
    if (kpiFilter === 'RESOLVED') return inc.status === 'RESOLVED'
    return true
  })

  // Devices filter only shows live handheld terminals; Incident filters only show submitted reports
  const mapIncidents = kpiFilter === 'DEVICES' ? [] : filteredIncidents
  const mapResponders = kpiFilter === 'DEVICES' ? responders : []

  const handleKpiFilterChange = useCallback(
    (filter: KpiFilter) => {
      setKpiFilter(filter)
      if (filter === 'DEVICES' && responders.length > 0 && responders[0].location.lat && responders[0].location.lng) {
        mapRef.current?.flyTo([responders[0].location.lat, responders[0].location.lng], 16, { duration: 1.0 })
      }
    },
    [responders]
  )

  // Map Controls Callbacks
  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut()
  }, [])

  const handleLocate = useCallback(() => {
    // Center directly on the active live LoRa responder
    if (responders.length > 0 && responders[0].location.lat && responders[0].location.lng) {
      mapRef.current?.flyTo(
        [responders[0].location.lat, responders[0].location.lng],
        16,
        { duration: 1.0 }
      )
      return
    }
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
  }, [responders])

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
    // Send downlink dispatch command via Gateway Serial Bridge over LoRa
    sendDispatch(unitId, incidentId, 'Command approved: proceed to destination.')

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
          incidents={mapIncidents}
          responders={mapResponders}
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
                variants={kpiStripWrapperVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="pointer-events-auto absolute left-3 sm:left-5 top-20 z-20"
              >
                <KPIStrip
                  incidents={incidents}
                  respondersCount={responders.length}
                  activeFilter={kpiFilter}
                  onFilterChange={handleKpiFilterChange}
                  onClose={() => setIsKpiOpen(false)}
                  align="left"
                />
              </motion.div>
            ) : (
              <motion.div
                key="left-kpi-pill"
                initial={{ x: -20, opacity: 0, scale: 0.92 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: -20, opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto absolute left-3 sm:left-5 top-20 z-30"
              >
                <button
                  type="button"
                  onClick={() => setIsKpiOpen(true)}
                  className={`flex h-9.5 w-[130px] items-center justify-center gap-2 rounded-full salbar-tactile-btn cursor-pointer select-none ${
                    isLight
                      ? 'bg-white text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-surface)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                  }`}
                  title="Show Metrics"
                  aria-label="Show Metrics"
                >
                  <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)]">
                    METRICS
                  </span>
                  <ChevronRight size={14} className="text-[var(--accent-primary)] shrink-0" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* 2.b Bottom-Left: Tactical Map Controls Dock or Minimized / Focus Action */}
        <div className="pointer-events-auto absolute bottom-4 left-3 sm:left-5 z-30 h-13 sm:h-14 flex items-center">
          <AnimatePresence mode="wait">
            {isFocusMode ? (
              <motion.div
                key="focus-mode-toggle"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  type="button"
                  onClick={toggleFocusMode}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-[var(--accent-primary)] text-white salbar-tactile-btn hover:bg-[var(--accent-hover)] hover:border-[var(--tactile-border)] cursor-pointer"
                  title="Exit Focus Mode (Return to Normal)"
                  aria-label="Exit Focus Mode"
                >
                  <Minimize2 size={18} />
                </button>
              </motion.div>
            ) : !isControlsOpen ? (
              <motion.div
                key="controls-reveal-toggle"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  type="button"
                  onClick={() => setIsControlsOpen(true)}
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center salbar-tactile-btn cursor-pointer ${
                    isLight
                      ? 'bg-white text-slate-800 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-surface)] text-slate-200 hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                  }`}
                  title="Show Map Controls"
                  aria-label="Show Map Controls"
                >
                  <ChevronRight size={18} />
                </button>
              </motion.div>
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
              className={`transition-all duration-300 pr-1 pb-1 ${
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
              <div className="h-1/2 min-h-[260px] pr-1 pb-1">
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
                className={`pointer-events-auto flex h-9.5 w-[130px] items-center justify-center gap-2 rounded-full salbar-tactile-btn cursor-pointer select-none ${
                  isLight
                    ? 'bg-white text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
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
                  <motion.div
                    key="right-kpi-pill"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="pointer-events-auto"
                  >
                    <button
                      type="button"
                      onClick={() => setIsKpiOpen(true)}
                      className={`flex h-9.5 w-[130px] items-center justify-center gap-2 rounded-full salbar-tactile-btn cursor-pointer select-none ${
                        isLight
                          ? 'bg-white text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-surface)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)]'
                      }`}
                      title="Show Metrics"
                      aria-label="Show Metrics"
                    >
                      <ChevronLeft size={14} className="text-[var(--accent-primary)] shrink-0" />
                      <span className="font-heading font-black text-xs uppercase tracking-wider text-[var(--accent-primary)]">
                        METRICS
                      </span>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="right-kpi-strip"
                    variants={kpiStripWrapperVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="pointer-events-auto"
                  >
                    <KPIStrip
                      incidents={incidents}
                      respondersCount={responders.length}
                      activeFilter={kpiFilter}
                      onFilterChange={handleKpiFilterChange}
                      onClose={() => setIsKpiOpen(false)}
                      align="right"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2.d Bottom-Right: Temporary GPS Acquiring Status Dock (opposite MapControlsDock) */}
        {!isFocusMode && acquiringResponders.length > 0 && (
          <div className="pointer-events-auto absolute bottom-4 right-3 sm:right-5 z-30 h-13 sm:h-14 flex items-center">
            <AnimatePresence mode="wait">
              {!isGpsStatusOpen ? (
                <motion.div
                  key="gps-status-reveal-toggle"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    type="button"
                    onClick={() => setIsGpsStatusOpen(true)}
                    className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center salbar-tactile-btn cursor-pointer ${
                      isLight
                        ? 'bg-white text-slate-800 hover:text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] text-slate-200 hover:text-[var(--accent-primary)]'
                    }`}
                    title="Show GPS Acquisition Status"
                    aria-label="Show GPS Status"
                  >
                    <ChevronLeft size={18} />
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--tactile-border)] ${
                        acquiringResponders.some((r) => r.location.gpsModuleOk === false)
                          ? 'bg-red-500'
                          : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="gps-status-dock"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className={`pointer-events-auto h-13 sm:h-14 flex items-center gap-2.5 rounded-full pl-4 pr-2.5 select-none salbar-tactile-card transition-colors duration-300 ${
                    isLight
                      ? 'bg-white text-slate-900'
                      : 'bg-[var(--bg-surface)] text-slate-100'
                  }`}
                >
                  <div className="flex flex-col justify-center gap-0.5">
                    {acquiringResponders.map((r) => {
                      const isModuleError = r.location.gpsModuleOk === false
                      return (
                        <div key={`gps-${r.id}`} className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isModuleError ? 'bg-red-500' : 'bg-amber-500 animate-pulse'
                            }`}
                          />
                          <span
                            className={`font-mono text-[11px] font-bold whitespace-nowrap ${
                              isModuleError
                                ? 'text-red-500 dark:text-red-400'
                                : isLight
                                  ? 'text-amber-600'
                                  : 'text-amber-400'
                            }`}
                          >
                            {r.id}:{' '}
                            {isModuleError
                              ? 'GPS MODULE NOT RESPONDING'
                              : `GPS ACQUIRING (${r.location.satellitesInView ?? 0} sats)`}
                            {!(r.location.lat === 0 && r.location.lng === 0) && ' • last known'}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className={`w-px h-5 my-auto ${isLight ? 'bg-slate-300' : 'bg-[var(--border-subtle)]'}`} />

                  <button
                    type="button"
                    onClick={() => setIsGpsStatusOpen(false)}
                    title="Hide GPS Status"
                    aria-label="Hide GPS Status"
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center salbar-tactile-sm cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 text-slate-600 hover:text-[var(--accent-primary)] hover:bg-slate-200/80'
                        : 'bg-[var(--bg-surface-elevated)] text-slate-400 hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    <ChevronRight size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommandMapScreen
