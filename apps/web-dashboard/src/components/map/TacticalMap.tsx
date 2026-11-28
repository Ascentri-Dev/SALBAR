import { useEffect, useMemo, useRef, useId } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Battery,
  Radio,
  Navigation,
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { IncidentReport, FieldResponder, RoadHazard } from '../../types/cad'

export type MapTileType = 'standard' | 'humanitarian'

const getTileUrl = (type: MapTileType) => {
  if (type === 'humanitarian') {
    return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
  }
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
}

// Traveling perimeter laser highlight tailored for disaster operations UI cards
const BorderBeam = ({ delay = 0, color = "#ff6b00" }: { delay?: number; color?: string }) => {
  const id = useId()
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-20">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#111c38" stopOpacity="0" />
            <stop offset="50%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#111c38" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="16"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="2"
          strokeDasharray="100 800"
          animate={{
            strokeDashoffset: [900, 0],
          }}
          transition={{
            duration: 7,
            delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </svg>
    </div>
  )
}

export interface TacticalMapProps {
  incidents: IncidentReport[]
  responders: FieldResponder[]
  /** All live units for the GPS status chip (shown even when unit pins are filtered out) */
  gpsStatusResponders?: FieldResponder[]
  hazards: RoadHazard[]
  selectedIncidentId: string | null
  onSelectIncident: (incidentId: string) => void
  onApproveDispatch: (incidentId: string, unitId: string) => void
  mapTileType?: MapTileType
  isMapDark?: boolean
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
  const isReview = incident.status === 'PROPOSAL_PENDING'

  let fillColor = '#0284C7'
  let iconSvg = ''

  if (isResolved) {
    fillColor = '#10B981' // Green
    iconSvg = `<polyline points="9.5,14 12.5,17 18.5,10.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  } else if (isCritical) {
    fillColor = '#DC2626' // Red with warning triangle
    iconSvg = `
      <path d="M14 7L20.5 19H7.5L14 7Z" stroke="white" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
      <line x1="14" y1="12" x2="14" y2="15" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="14" cy="17.2" r="0.9" fill="white"/>
    `
  } else if (isHigh) {
    fillColor = '#EA580C' // Orange with warning triangle
    iconSvg = `
      <path d="M14 7L20.5 19H7.5L14 7Z" stroke="white" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
      <line x1="14" y1="12" x2="14" y2="15" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="14" cy="17.2" r="0.9" fill="white"/>
    `
  } else if (isReview) {
    fillColor = '#8B5CF6' // Purple with search/inspection icon
    iconSvg = `
      <circle cx="13" cy="13" r="4.5" stroke="white" stroke-width="1.8" fill="none"/>
      <line x1="16.5" y1="16.5" x2="20" y2="20" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
    `
  } else {
    fillColor = '#D97706' // Amber with clock icon
    iconSvg = `
      <circle cx="14" cy="14" r="5.5" stroke="white" stroke-width="1.6" fill="none"/>
      <polyline points="14,11 14,14 16.5,14" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    `
  }

  const selectedClass = isSelected ? 'scale-125 z-50' : 'hover:scale-115'
  // Last-known (not live) position: faded pin with a dashed outline
  const isLastKnown = (incident.location.positionAgeS ?? 0) > 0
  const pinStyle = isLastKnown ? 'opacity: 0.6;' : ''
  const strokeDash = isLastKnown ? 'stroke-dasharray="3 2"' : ''

  const html = `
    <div class="relative flex flex-col items-center justify-center cursor-pointer select-none transition-transform duration-200 ${selectedClass}" style="${pinStyle}">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
        <path d="M14 0.5C6.54 0.5 0.5 6.54 0.5 14C0.5 22.8 11.2 31.8 14 35.5C16.8 31.8 27.5 22.8 27.5 14C27.5 6.54 21.46 0.5 14 0.5Z"
              fill="${fillColor}"
              stroke="#FFFFFF"
              stroke-width="2" ${strokeDash} />
        ${iconSvg}
      </svg>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-svg-pin',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  })
}

function createResponderMarkerIcon(responder: FieldResponder): L.DivIcon {
  const isAvailable = responder.status === 'AVAILABLE'
  const isEnRoute = responder.status === 'EN_ROUTE'
  const fillColor = isAvailable ? '#059669' : isEnRoute ? '#EA580C' : '#0284C7'

  const html = `
    <div class="relative flex flex-col items-center justify-center cursor-pointer select-none hover:scale-110 transition-transform duration-200">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
        <path d="M14 0.5C6.54 0.5 0.5 6.54 0.5 14C0.5 22.8 11.2 31.8 14 35.5C16.8 31.8 27.5 22.8 27.5 14C27.5 6.54 21.46 0.5 14 0.5Z"
              fill="${fillColor}"
              stroke="#FFFFFF"
              stroke-width="2" />
        <!-- Navigation Arrow Icon -->
        <polygon points="14,8 19,19 14,16.5 9,19" fill="white"/>
      </svg>
      <!-- Callsign Pill beneath pin tip matching HQ DEPOT style -->
      <div class="bg-[#0b1329]/95 border border-cyan-400 text-cyan-400 font-mono text-[9px] font-black px-1.5 py-0.2 rounded-xs uppercase tracking-wider -mt-1 shadow-lg whitespace-nowrap">
        ${responder.id}
      </div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-responder-pin',
    iconSize: [48, 52],
    iconAnchor: [24, 36],
    popupAnchor: [0, -38],
  })
}

export function TacticalMap({
  incidents,
  responders,
  gpsStatusResponders,
  hazards,
  selectedIncidentId,
  onSelectIncident,
  onApproveDispatch,
  mapTileType = 'standard',
  isMapDark = true,
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
    <div
      className={`relative w-full h-full min-h-[300px] overflow-hidden transition-colors duration-500 ${
        isMapDark ? 'dark-map' : ''
      } ${className}`.trim()}
    >
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
              className: 'salbar-hazard-pin',
              html: `
                <div class="relative flex flex-col items-center justify-center cursor-pointer select-none hover:scale-115 transition-transform duration-200">
                  <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
                    <path d="M14 0.5C6.54 0.5 0.5 6.54 0.5 14C0.5 22.8 11.2 31.8 14 35.5C16.8 31.8 27.5 22.8 27.5 14C27.5 6.54 21.46 0.5 14 0.5Z"
                          fill="#D97706"
                          stroke="#FFFFFF"
                          stroke-width="2" />
                    <!-- Exclamation Hazard Icon -->
                    <line x1="14" y1="9" x2="14" y2="16" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                    <circle cx="14" cy="19.5" r="1.1" fill="white"/>
                  </svg>
                </div>
              `,
              iconSize: [28, 36],
              iconAnchor: [14, 36],
              popupAnchor: [0, -38],
            })}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="relative overflow-hidden bg-[var(--bg-surface)] salbar-tactile-card salbar-reveal-up m-1 p-4 rounded-2xl text-xs text-[var(--text-primary)] w-60 font-sans select-none">
                <BorderBeam delay={0} color="#F59E0B" />
                <div className="relative z-10 flex items-center gap-1.5 text-amber-400 font-bold mb-1.5 text-[11px] font-mono tracking-wider">
                  <AlertTriangle size={13} />
                  <span>ROAD BLOCKAGE</span>
                </div>
                <div className="relative z-10 font-bold text-xs mb-1.5 text-[var(--text-primary)]">
                  {haz.name}
                </div>
                <div className="relative z-10 text-[11px] text-[var(--text-secondary)] font-mono">
                  Reroute Delay: <strong className="text-amber-400">+{haz.penaltyMinutes} mins</strong>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Field Responder Units (units that never had a GPS fix sit at 0,0 and are not plotted) */}
        {responders.filter((resp) => !(resp.location.lat === 0 && resp.location.lng === 0)).map((resp) => (
          <Marker
            key={resp.id}
            position={[resp.location.lat, resp.location.lng]}
            icon={createResponderMarkerIcon(resp)}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="relative overflow-hidden bg-[var(--bg-surface)] salbar-tactile-card salbar-reveal-up m-1 p-4 rounded-2xl text-xs text-[var(--text-primary)] w-68 sm:w-72 font-sans select-none">
                <BorderBeam delay={0} color="#10B981" />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-heading font-black text-sm text-[var(--text-primary)] tracking-wide">
                      {resp.name}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {resp.status}
                  </span>
                </div>

                {/* Telemetry Matrix Grid */}
                <div className="relative z-10 space-y-2 mb-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border-2 border-[var(--tactile-border)]">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)] uppercase">
                        <Battery size={12} className="text-emerald-400" />
                        <span>Power Level</span>
                      </div>
                      <div className="font-mono font-bold text-sm text-[var(--text-primary)] mt-0.5">
                        {resp.batteryPercent}% <span className="text-[10px] text-[var(--text-secondary)] font-normal">({resp.batteryVoltage}V)</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border-2 border-[var(--tactile-border)]">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)] uppercase">
                        <Radio size={12} className="text-[var(--accent-primary)]" />
                        <span>LoRa Link</span>
                      </div>
                      <div className="font-mono font-bold text-xs text-[var(--text-primary)] mt-0.5">
                        915 MHz <span className="text-[10px] text-emerald-400 font-normal">Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border-2 border-[var(--tactile-border)] flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                      <Navigation size={12} className="text-cyan-400" />
                      <span>GNSS Precision</span>
                    </div>
                    <div className="font-mono font-bold text-cyan-400 text-[10px]">
                      {resp.location.gpsFix === false
                        ? `NO FIX - last known (${resp.location.satellites ?? 0} sats)`
                        : `Kalman (+/-${resp.location.accuracyMeters}m${
                            resp.location.satellites !== undefined ? `, ${resp.location.satellites} sats` : ''
                          })`}
                    </div>
                  </div>
                </div>

                {/* Coordinates & Last Seen Footer */}
                <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)]">
                  <span>{resp.location.lat.toFixed(5)}, {resp.location.lng.toFixed(5)}</span>
                  <span className="text-emerald-400 font-bold">{resp.lastSeen}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Incident Reports (reports without a GPS fix are listed but not plotted) */}
        {incidents.filter((inc) => !(inc.location.lat === 0 && inc.location.lng === 0)).map((inc) => {
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
                <div className="relative overflow-hidden bg-[var(--bg-surface)] salbar-tactile-card salbar-reveal-up m-1 p-4 rounded-2xl text-xs text-[var(--text-primary)] w-72 sm:w-80 font-sans select-none">
                  <BorderBeam delay={0} color={inc.urgency === 'CRITICAL' ? '#EF4444' : '#ff6b00'} />

                  {/* Header */}
                  <div className="relative z-10 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2">
                    <div>
                      <div className="text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        {inc.id}
                      </div>
                      <div className="font-heading font-black text-xs text-[var(--text-primary)]">
                        {inc.location.name}
                      </div>
                    </div>
                    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      inc.status === 'RESOLVED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : inc.urgency === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                          : inc.urgency === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {inc.status === 'RESOLVED' ? 'RESOLVED' : inc.urgency}
                    </span>
                  </div>

                  {/* Raw Field Quote */}
                  <div className="relative z-10 p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border-2 border-[var(--tactile-border)] mb-2.5">
                    <div className="text-[9px] font-mono uppercase text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                      <span>LoRa Transmission</span>
                      <span className="text-[var(--accent-primary)] font-bold">{inc.detectedLanguage}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-primary)] italic line-clamp-2 leading-relaxed">
                      "{inc.rawText}"
                    </p>
                  </div>

                  {/* AI Briefing summary */}
                  {inc.aiBriefing && (
                    <p className="relative z-10 text-[10px] text-[var(--text-secondary)] line-clamp-2 mb-3 leading-snug">
                      {inc.aiBriefing}
                    </p>
                  )}

                  {/* Action Dispatch Button */}
                  <div className="relative z-10 pt-2 border-t border-[var(--border-subtle)]">
                    {inc.status === 'RESOLVED' ? (
                      <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-2 rounded-full text-center uppercase tracking-wider flex items-center justify-center gap-1">
                        <CheckCircle size={12} /> Incident Resolved
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
                        className="w-full py-2.5 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-mono font-bold uppercase tracking-wider rounded-full flex items-center justify-center gap-2 salbar-tactile-btn cursor-pointer group"
                      >
                        <span>{inc.status === 'DISPATCHED' ? 'View Live Dispatch' : 'Approve & Dispatch via LoRa'}</span>
                        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* GPS acquisition status for terminals without a current fix */}
      {(gpsStatusResponders ?? responders).some((r) => r.location.gpsFix === false) && (
        <div className="absolute top-28 left-3 sm:left-5 z-[1000] flex flex-col gap-1.5 pointer-events-none">
          {(gpsStatusResponders ?? responders)
            .filter((r) => r.location.gpsFix === false)
            .map((r) => (
              <div
                key={`gps-${r.id}`}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border backdrop-blur-md shadow-md ${
                  r.location.gpsModuleOk === false
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                {r.id}:{' '}
                {r.location.gpsModuleOk === false
                  ? 'GPS MODULE NOT RESPONDING'
                  : `GPS ACQUIRING (${r.location.satellitesInView ?? 0} satellites in view)`}
                {!(r.location.lat === 0 && r.location.lng === 0) && ' - showing last known'}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default TacticalMap

