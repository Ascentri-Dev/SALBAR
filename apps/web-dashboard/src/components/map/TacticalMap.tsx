import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { CheckCircle, Shield, AlertTriangle, ArrowRight } from 'lucide-react'
import type { IncidentReport, FieldResponder, RoadHazard } from '../../types/cad'

export type MapTileType = 'standard' | 'humanitarian'

const getTileUrl = (type: MapTileType) => {
  if (type === 'humanitarian') {
    return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
  }
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
}

export interface TacticalMapProps {
  incidents: IncidentReport[]
  responders: FieldResponder[]
  hazards: RoadHazard[]
  selectedIncidentId: string | null
  onSelectIncident: (incidentId: string) => void
  onApproveDispatch: (incidentId: string, unitId: string) => void
  mapTileType?: MapTileType
  className?: string
  mapRef?: React.RefObject<L.Map | null>
}

const DEFAULT_CENTER: [number, number] = [10.3157, 123.8854]
const DEFAULT_ZOOM = 14

function MapViewController({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 16, { duration: 1.0 })
    }
  }, [map, targetCoords])
  return null
}

function createIncidentMarkerIcon(
  incident: IncidentReport,
  isSelected: boolean
): L.DivIcon {
  const isCritical = incident.urgency === 'CRITICAL' && incident.status !== 'RESOLVED'
  const isHigh = incident.urgency === 'HIGH' && incident.status !== 'RESOLVED'
  const isResolved = incident.status === 'RESOLVED'

  let pinColor = '#3B82F6' // Blue (Pending)
  if (isResolved) {
    pinColor = '#10B981' // Green
  } else if (isCritical) {
    pinColor = '#EF4444' // Red
  } else if (isHigh) {
    pinColor = '#EA580C' // Orange
  } else if (incident.urgency === 'MODERATE') {
    pinColor = '#F59E0B' // Amber
  }

  const pulseRing = isCritical
    ? `<span style="border-color: ${pinColor};" class="absolute -inset-2.5 rounded-full border-2 animate-ping opacity-75"></span>`
    : ''

  const selectionRing = isSelected
    ? `<span class="absolute -inset-3.5 rounded-full border-2 border-[var(--accent-primary)] animate-pulse"></span>`
    : ''

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer select-none">
      ${pulseRing}
      ${selectionRing}
      <div style="background-color: ${pinColor};" class="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
        ${isCritical ? '!' : isResolved ? '&#10003;' : ''}
      </div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-marker-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

function createResponderMarkerIcon(responder: FieldResponder): L.DivIcon {
  const isAvailable = responder.status === 'AVAILABLE'
  const statusColor = isAvailable ? '#10B981' : '#EA580C'

  const html = `
    <div class="relative flex flex-col items-center cursor-pointer select-none">
      <div class="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl text-[10px] font-sans font-bold text-[var(--text-primary)]">
        <span style="background-color: ${statusColor};" class="w-2 h-2 rounded-full inline-block"></span>
        <span>${responder.id}</span>
      </div>
      <div class="w-1.5 h-1.5 rotate-45 border-r border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] -mt-0.5"></div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-responder-icon',
    iconSize: [64, 24],
    iconAnchor: [32, 24],
    popupAnchor: [0, -26],
  })
}

export function TacticalMap({
  incidents,
  responders,
  hazards,
  selectedIncidentId,
  onSelectIncident,
  onApproveDispatch,
  mapTileType = 'standard',
  className = '',
  mapRef,
}: TacticalMapProps) {
  const internalMapRef = useRef<L.Map | null>(null)
  const actualMapRef = mapRef || internalMapRef
  const markerRefs = useRef<{ [key: string]: L.Marker | null }>({})

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) || null,
    [incidents, selectedIncidentId]
  )

  const targetCoords = useMemo<[number, number] | null>(() => {
    if (selectedIncident) {
      return [selectedIncident.location.lat, selectedIncident.location.lng]
    }
    return null
  }, [selectedIncident])

  // Automatically open popup of selected incident
  useEffect(() => {
    if (selectedIncidentId && markerRefs.current[selectedIncidentId]) {
      markerRefs.current[selectedIncidentId]?.openPopup()
    }
  }, [selectedIncidentId])

  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden ${className}`}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full z-0"
        ref={actualMapRef}
      >
        <TileLayer url={getTileUrl(mapTileType)} maxZoom={19} />

        <MapViewController targetCoords={targetCoords} />

        {/* Road Hazards */}
        {hazards.map((haz) => (
          <Marker
            key={haz.id}
            position={[haz.lat, haz.lng]}
            icon={L.divIcon({
              html: `
                <div class="w-5 h-5 rounded-sm bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-500 font-bold text-xs shadow-md">
                  !
                </div>
              `,
              className: 'salbar-hazard-icon',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="bg-[var(--bg-surface)] border border-amber-500/40 p-3 rounded-sm shadow-2xl text-xs text-[var(--text-primary)] w-56 font-sans">
                <div className="flex items-center gap-1.5 text-amber-500 font-bold mb-1">
                  <AlertTriangle size={14} />
                  <span>ROAD BLOCKAGE</span>
                </div>
                <div className="font-semibold text-xs mb-1">{haz.name}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Reroute Penalty: <strong className="text-[var(--text-primary)]">+{haz.penaltyMinutes} mins</strong>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Field Responder Units */}
        {responders.map((resp) => (
          <Marker
            key={resp.id}
            position={[resp.location.lat, resp.location.lng]}
            icon={createResponderMarkerIcon(resp)}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 rounded-sm shadow-2xl text-xs text-[var(--text-primary)] w-60 font-sans">
                <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-1.5 mb-2">
                  <span className="font-bold text-sm text-[var(--accent-primary)] flex items-center gap-1">
                    <Shield size={14} /> {resp.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                    {resp.status}
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                  <div>Role: <strong className="text-[var(--text-primary)]">{resp.role}</strong></div>
                  <div>Battery: <strong className="text-[var(--text-primary)]">{resp.batteryPercent}% ({resp.batteryVoltage}V)</strong></div>
                  <div>Fatigue Score: <strong className="text-[var(--text-primary)]">{resp.fatigueScore}%</strong></div>
                  <div className="text-[10px] text-[var(--color-emergency-telemetry)] font-mono">
                    GPS: Kalman Filtered (+/-{resp.location.accuracyMeters}m)
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Incident Reports */}
        {incidents.map((inc) => {
          const isSelected = inc.id === selectedIncidentId
          return (
            <Marker
              key={inc.id}
              position={[inc.location.lat, inc.location.lng]}
              icon={createIncidentMarkerIcon(inc, isSelected)}
              ref={(ref) => {
                if (ref) markerRefs.current[inc.id] = ref
                else delete markerRefs.current[inc.id]
              }}
              eventHandlers={{
                click: () => onSelectIncident(inc.id),
              }}
            >
              <Popup closeButton={false} className="salbar-popup">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 rounded-sm shadow-2xl text-xs text-[var(--text-primary)] w-64 font-sans">
                  <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-1.5 mb-2">
                    <span className="font-mono font-bold text-xs text-[var(--text-secondary)]">
                      {inc.id}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        inc.status === 'RESOLVED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : inc.urgency === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : inc.urgency === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {inc.status === 'RESOLVED' ? 'RESOLVED' : inc.urgency}
                    </span>
                  </div>

                  <div className="font-semibold text-xs mb-1 text-[var(--text-primary)]">
                    {inc.location.name}
                  </div>

                  <p className="text-[11px] text-[var(--text-secondary)] italic mb-3 line-clamp-2 leading-relaxed">
                    "{inc.rawText}"
                  </p>

                  {inc.status === 'RESOLVED' ? (
                    <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-1.5 rounded-sm text-center uppercase tracking-wider flex items-center justify-center gap-1">
                      <CheckCircle size={12} /> Resolved
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectIncident(inc.id)
                        if (inc.status !== 'DISPATCHED') {
                          onApproveDispatch(inc.id, inc.recommendedUnitId)
                        }
                      }}
                      className="w-full bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[10px] font-bold py-2 rounded-sm transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span>{inc.status === 'DISPATCHED' ? 'View Dispatch' : 'Quick Dispatch Unit'}</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export default TacticalMap
