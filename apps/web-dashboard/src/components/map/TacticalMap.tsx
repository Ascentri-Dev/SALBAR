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

  let pinColor = '#3B82F6'
  let glowColor = 'rgba(59, 130, 246, 0.4)'
  if (isResolved) {
    pinColor = '#10B981'
    glowColor = 'rgba(16, 185, 129, 0.4)'
  } else if (isCritical) {
    pinColor = '#EF4444'
    glowColor = 'rgba(239, 68, 68, 0.55)'
  } else if (isHigh) {
    pinColor = '#EA580C'
    glowColor = 'rgba(234, 88, 12, 0.45)'
  } else if (incident.urgency === 'MODERATE') {
    pinColor = '#F59E0B'
    glowColor = 'rgba(245, 158, 11, 0.4)'
  }

  const pulseRing = (isCritical || isHigh)
    ? `<span style="border-color: ${pinColor};" class="absolute -inset-2.5 rounded-full border-2 animate-ping opacity-75"></span>
       <span style="border-color: ${pinColor};" class="absolute -inset-1 rounded-full border animate-pulse opacity-60"></span>`
    : ''

  const selectionRing = isSelected
    ? `<span class="absolute -inset-3.5 rounded-full border-2 border-[var(--accent-primary)] animate-pulse"></span>`
    : ''

  const label = isCritical ? 'SOS' : isHigh ? '!' : isResolved ? '&#10003;' : 'INC'

  const html = `
    <div class="relative flex flex-col items-center justify-center cursor-pointer select-none group">
      ${pulseRing}
      ${selectionRing}
      
      <!-- Beacon Body -->
      <div class="relative z-10 flex items-center justify-center px-3 py-1 rounded-full bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-2xl transition-transform duration-200 group-hover:scale-110"
           style="box-shadow: 0 4px 14px rgba(0,0,0,0.5), 0 0 10px ${glowColor};">
        <span class="w-2 h-2 rounded-full mr-1.5 inline-block" style="background-color: ${pinColor};"></span>
        <span class="font-mono text-[10px] font-black uppercase tracking-wider" style="color: ${pinColor};">
          ${label}
        </span>
      </div>
      
      <!-- Downward Pointer Arrow -->
      <div class="w-1.5 h-1.5 rotate-45 border-r border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] -mt-1 z-10"></div>
      <div class="w-2 h-2 rounded-full -mt-0.5" style="background-color: ${pinColor}; box-shadow: 0 0 6px ${pinColor};"></div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-marker-icon',
    iconSize: [64, 34],
    iconAnchor: [32, 34],
    popupAnchor: [0, -36],
  })
}

function createResponderMarkerIcon(responder: FieldResponder): L.DivIcon {
  const isAvailable = responder.status === 'AVAILABLE'
  const isEnRoute = responder.status === 'EN_ROUTE'
  const statusColor = isAvailable ? '#10B981' : isEnRoute ? '#EA580C' : '#3B82F6'
  const statusGlow = isAvailable ? 'rgba(16, 185, 129, 0.45)' : 'rgba(234, 88, 12, 0.45)'
  const battery = responder.batteryPercent ?? 100

  const html = `
    <div class="relative flex flex-col items-center cursor-pointer select-none group">
      <!-- Pulsing Ground Radar Ripple for Live LoRa Transmission -->
      <div class="absolute -bottom-1 w-8 h-8 rounded-full border-2 animate-ping pointer-events-none opacity-40"
           style="border-color: ${statusColor};"></div>
      <div class="absolute -bottom-0.5 w-3 h-3 rounded-full opacity-80"
           style="background-color: ${statusColor}; box-shadow: 0 0 8px ${statusGlow};"></div>

      <!-- Tactical Floating Pill Badge -->
      <div class="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-2xl transition-transform duration-200 group-hover:scale-105"
           style="box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 12px ${statusGlow};">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background-color: ${statusColor};"></span>
          <span class="relative inline-flex rounded-full h-2 w-2" style="background-color: ${statusColor};"></span>
        </span>
        <span class="font-mono text-[11px] font-black tracking-wider text-[var(--text-primary)]">
          ${responder.id}
        </span>
        <span class="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-emerald-400">
          ${battery}%
        </span>
      </div>

      <!-- Downward Pointer Arrow -->
      <div class="w-2 h-2 rotate-45 border-r border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] -mt-1 z-10"></div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'salbar-responder-icon',
    iconSize: [116, 38],
    iconAnchor: [58, 38],
    popupAnchor: [0, -40],
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
              html: `
                <div class="relative flex flex-col items-center cursor-pointer select-none">
                  <div class="w-7 h-7 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-500 font-bold text-xs shadow-lg backdrop-blur-md">
                    !
                  </div>
                  <div class="w-1.5 h-1.5 rotate-45 border-r border-b border-amber-500 bg-[var(--bg-surface)] -mt-1"></div>
                </div>
              `,
              className: 'salbar-hazard-icon',
              iconSize: [28, 30],
              iconAnchor: [14, 30],
              popupAnchor: [0, -32],
            })}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="relative overflow-hidden bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-amber-500/40 p-4 rounded-2xl shadow-2xl text-xs text-[var(--text-primary)] w-60 font-sans select-none">
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

        {/* Field Responder Units */}
        {responders.map((resp) => (
          <Marker
            key={resp.id}
            position={[resp.location.lat, resp.location.lng]}
            icon={createResponderMarkerIcon(resp)}
          >
            <Popup closeButton={false} className="salbar-popup">
              <div className="relative overflow-hidden bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] p-4 rounded-2xl shadow-2xl text-xs text-[var(--text-primary)] w-68 sm:w-72 font-sans select-none">
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
                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border border-[var(--border-subtle)]/70">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)] uppercase">
                        <Battery size={12} className="text-emerald-400" />
                        <span>Power Level</span>
                      </div>
                      <div className="font-mono font-bold text-sm text-[var(--text-primary)] mt-0.5">
                        {resp.batteryPercent}% <span className="text-[10px] text-[var(--text-secondary)] font-normal">({resp.batteryVoltage}V)</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border border-[var(--border-subtle)]/70">
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)] uppercase">
                        <Radio size={12} className="text-[var(--accent-primary)]" />
                        <span>LoRa Link</span>
                      </div>
                      <div className="font-mono font-bold text-xs text-[var(--text-primary)] mt-0.5">
                        915 MHz <span className="text-[10px] text-emerald-400 font-normal">Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border border-[var(--border-subtle)]/70 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                      <Navigation size={12} className="text-cyan-400" />
                      <span>GNSS Precision</span>
                    </div>
                    <div className="font-mono font-bold text-cyan-400 text-[10px]">
                      Kalman (+/-{resp.location.accuracyMeters}m)
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
                <div className="relative overflow-hidden bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] p-4 rounded-2xl shadow-2xl text-xs text-[var(--text-primary)] w-72 sm:w-80 font-sans select-none">
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
                  <div className="relative z-10 p-2.5 rounded-xl bg-[var(--bg-surface-elevated)]/60 border border-[var(--border-subtle)]/70 mb-2.5">
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
                        className="w-full py-2.5 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-mono font-bold uppercase tracking-wider rounded-full transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 group"
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
    </div>
  )
}

export default TacticalMap

