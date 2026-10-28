import { useState, useRef, useCallback } from 'react'
import L from 'leaflet'
import { TacticalMap, type MapTileType } from '../../components/map/TacticalMap'
import { KPIStrip, type KpiFilter } from '../../components/kpi/KPIStrip'
import { IncidentStreamPanel } from '../../components/stream/IncidentStreamPanel'
import { HITLDispatchDrawer } from '../../components/dispatch/HITLDispatchDrawer'
import { MapControlsDock } from '../../components/map/MapControlsDock'
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
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS)
  const [responders, setResponders] = useState<FieldResponder[]>(INITIAL_RESPONDERS)
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null)
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('ALL')

  const [mapTileType, setMapTileType] = useState<MapTileType>('standard')
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isQueueOpen, setIsQueueOpen] = useState(true)

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
          // Fallback to default operational coordinates
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

  const handleToggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => !prev)
  }, [])

  const handleToggleQueue = useCallback(() => {
    setIsQueueOpen((prev) => !prev)
  }, [])

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
          mapRef={mapRef}
        />
      </div>

      {/* 2. Floating Command HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {/* 2.a Top: Floating KPI & Filter Strip */}
        <div
          className={`pointer-events-auto absolute left-2 right-2 md:left-6 md:right-6 z-20 transition-all duration-300 ease-in-out ${
            isFocusMode ? '-top-28 opacity-0 pointer-events-none' : 'top-3 opacity-100'
          }`}
        >
          <KPIStrip
            incidents={incidents}
            activeFilter={kpiFilter}
            onFilterChange={setKpiFilter}
          />
        </div>

        {/* 2.b Right: Live CAD Dispatch Queue & HITL Authorization Drawer */}
        <div
          data-testid="incident-stream-panel"
          className={`pointer-events-auto absolute right-2 md:right-4 bottom-20 top-18 z-20 w-[340px] lg:w-[400px] flex flex-col transition-transform duration-300 ease-out ${
            !isQueueOpen || isFocusMode
              ? 'translate-x-[calc(100%+1.5rem)]'
              : 'translate-x-0'
          }`}
        >
          <div className="relative h-full flex flex-col min-h-0 gap-2">
            {/* Top segment: Live Queue Feed */}
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

        {/* 2.c Center-Bottom: Floating Tactical Map Controls Dock */}
        <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <MapControlsDock
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onLocate={handleLocate}
            mapTileType={mapTileType}
            onToggleTileType={handleToggleTileType}
            isFocusMode={isFocusMode}
            onToggleFocusMode={handleToggleFocusMode}
            isQueueOpen={isQueueOpen}
            onToggleQueue={handleToggleQueue}
          />
        </div>
      </div>
    </div>
  )
}

export default CommandMapScreen
