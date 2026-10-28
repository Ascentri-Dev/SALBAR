import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Shield, AlertTriangle, Radio, Navigation } from 'lucide-react'
import type { IncidentReport, FieldResponder, RoadHazard } from '../../types/cad'
import { useTheme } from '../../context'

export interface TacticalMapProps {
  incidents: IncidentReport[]
  responders: FieldResponder[]
  hazards: RoadHazard[]
  selectedIncident: IncidentReport | null
  onSelectIncident: (incident: IncidentReport) => void
  onSelectResponder?: (responder: FieldResponder) => void
  className?: string
}

const DEFAULT_CENTER: [number, number] = [10.3185, 123.887]
const DEFAULT_ZOOM = 14

function MapController({ targetPos }: { targetPos: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (targetPos) {
      map.flyTo(targetPos, 16, { duration: 1.2 })
    }
  }, [map, targetPos])
  return null
}

function createIncidentIcon(incident: IncidentReport, isSelected: boolean): L.DivIcon {
  const isCritical = incident.urgency === 'CRITICAL'
  const isHigh = incident.urgency === 'HIGH'
  const isResolved = incident.status === 'RESOLVED'

  let colorClass = 'bg-[var(--color-emergency-low)] border-white/60'
  let pingClass = ''

  if (isResolved) {
    colorClass = 'bg-[var(--color-emergency-success)] border-white/60'
  } else if (isCritical) {
    colorClass = 'bg-[var(--color-emergency-critical)] border-white'
    pingClass = '<span class="absolute -inset-2.5 rounded-full border-2 border-red-500 animate-ping opacity-75"></span>'
  } else if (isHigh) {
    colorClass = 'bg-[var(--accent-primary)] border-white'
    pingClass = '<span class="absolute -inset-2 rounded-full border-2 border-orange-400 animate-ping opacity-60"></span>'
  }

  const selectionRing = isSelected
    ? '<span class="absolute -inset-3.5 rounded-full border-2 border-[var(--accent-primary)] animate-pulse"></span>'
    : ''

  const html = `
    <div class="relative flex items-center justify-center w-5 h-5 rounded-full border-2 shadow-lg ${colorClass}">
      ${pingClass}
      ${selectionRing}
      <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-incident-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function createResponderIcon(responder: FieldResponder): L.DivIcon {
  const isAvailable = responder.status === 'AVAILABLE'
  const isEnRoute = responder.status === 'EN_ROUTE'
  const color = isAvailable
    ? 'border-[var(--color-emergency-success)] bg-[var(--bg-surface)]'
    : isEnRoute
      ? 'border-[var(--accent-primary)] bg-[var(--bg-surface)]'
      : 'border-[var(--border-focus)] bg-[var(--bg-surface)]'

  const html = `
    <div class="relative flex flex-col items-center">
      <div class="flex items-center gap-1 px-1.5 py-0.5 rounded border ${color} shadow-md text-[10px] font-mono font-bold text-[var(--text-primary)]">
        <span class="w-1.5 h-1.5 rounded-full ${
          isAvailable ? 'bg-[var(--color-emergency-success)]' : 'bg-[var(--accent-primary)]'
        }"></span>
        ${responder.id}
      </div>
      <div class="w-1.5 h-1.5 rotate-45 border-r border-b ${color} -mt-0.5 bg-[var(--bg-surface)]"></div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-responder-marker',
    iconSize: [60, 26],
    iconAnchor: [30, 26],
  })
}

function createHazardIcon(): L.DivIcon {
  const html = `
    <div class="w-4 h-4 rounded bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 font-bold text-[9px] shadow">
      !
    </div>
  `
  return L.divIcon({
    html,
    className: 'salbar-hazard-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export function TacticalMap({
  incidents,
  responders,
  hazards,
  selectedIncident,
  onSelectIncident,
  onSelectResponder,
  className = '',
}: TacticalMapProps) {
  const { theme } = useTheme()
  const mapRef = useRef<L.Map | null>(null)

  const isDark = theme === 'dark'
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  const targetCoords = useMemo<[number, number] | null>(() => {
    if (selectedIncident) {
      return [selectedIncident.location.lat, selectedIncident.location.lng]
    }
    return null
  }, [selectedIncident])

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1 })
    }
  }

  return (
    <div className={`relative w-full h-full min-h-[300px] overflow-hidden ${className}`}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="w-full h-full z-0"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={tileUrl}
        />

        <MapController targetPos={targetCoords} />

        {/* Hazard Markers */}
        {hazards.map((haz) => (
          <Marker
            key={haz.id}
            position={[haz.lat, haz.lng]}
            icon={createHazardIcon()}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="bg-[var(--bg-surface)] border border-amber-500/50 p-2.5 rounded shadow-xl text-xs font-mono text-[var(--text-primary)]">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                  <AlertTriangle size={14} />
                  <span>ROAD BLOCKAGE</span>
                </div>
                <div>{haz.name}</div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-1">
                  Penalty: +{haz.penaltyMinutes}m detour
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Field Responder Markers */}
        {responders.map((resp) => (
          <Marker
            key={resp.id}
            position={[resp.location.lat, resp.location.lng]}
            icon={createResponderIcon(resp)}
            eventHandlers={{
              click: () => onSelectResponder?.(resp),
            }}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 rounded shadow-xl text-xs text-[var(--text-primary)] w-56">
                <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-1.5 mb-2">
                  <span className="font-bold text-sm text-[var(--accent-primary)] flex items-center gap-1">
                    <Shield size={14} /> {resp.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                    {resp.status}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px] text-[var(--text-secondary)]">
                  <div>Role: <span className="text-[var(--text-primary)]">{resp.role}</span></div>
                  <div>Battery: <span className="text-[var(--text-primary)]">{resp.batteryPercent}% ({resp.batteryVoltage}V)</span></div>
                  <div>Fatigue Index: <span className="text-[var(--text-primary)]">{resp.fatigueScore}%</span></div>
                  <div>GPS: <span className="text-[var(--color-emergency-telemetry)]">Kalman Smoothed (+/-{resp.location.accuracyMeters}m)</span></div>
                  <div>BLE Relayed: <span className="text-[var(--text-primary)]">{resp.relayedReportsCount} reports</span></div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Incident Markers */}
        {incidents.map((inc) => (
          <Marker
            key={inc.id}
            position={[inc.location.lat, inc.location.lng]}
            icon={createIncidentIcon(inc, selectedIncident?.id === inc.id)}
            eventHandlers={{
              click: () => onSelectIncident(inc),
            }}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 rounded shadow-xl text-xs text-[var(--text-primary)] w-64">
                <div className="flex justify-between items-start border-b border-[var(--border-subtle)] pb-1.5 mb-2 gap-2">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-1">
                    <Radio size={14} className="text-[var(--accent-primary)]" /> {inc.id}
                  </span>
                  <span
                    className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      inc.urgency === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : inc.urgency === 'HIGH'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    }`}
                  >
                    {inc.urgency}
                  </span>
                </div>
                <div className="font-semibold text-xs mb-1 text-[var(--text-primary)]">
                  {inc.location.name}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] italic mb-2 line-clamp-2">
                  "{inc.rawText}"
                </p>
                <button
                  type="button"
                  onClick={() => onSelectIncident(inc)}
                  className="w-full py-1.5 px-2 rounded text-center text-xs font-bold uppercase tracking-wider bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Inspect and Triage
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Recenter GPS Floating Button */}
      <button
        type="button"
        onClick={handleResetView}
        title="Recenter Map"
        aria-label="Recenter Map View"
        className="absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-lg backdrop-blur-md transition-colors cursor-pointer"
      >
        <Navigation size={16} />
      </button>
    </div>
  )
}

export default TacticalMap

