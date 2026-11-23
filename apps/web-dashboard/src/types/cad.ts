export type EmergencyCategory =
  | 'trapped-persons'
  | 'medical-emergency'
  | 'flood-inundation'
  | 'structural-collapse'
  | 'landslide-hazard'
  | 'relief-supplies'

export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'

export type ReportSource = 'LORA_MESH_BLE' | 'LORA_DIRECT' | 'CLOUD_RELAY'

export type IncidentStatus = 'UNASSIGNED' | 'PROPOSAL_PENDING' | 'DISPATCHED' | 'RESOLVED'

export interface IncidentReport {
  id: string
  timestamp: string
  reportedAt: Date
  source: ReportSource
  rawText: string
  detectedLanguage: 'Cebuano' | 'Tagalog' | 'English' | 'Code-Switched'
  category: EmergencyCategory
  urgency: UrgencyLevel
  location: {
    name: string
    lat: number
    lng: number
    /** false = reported without a GPS fix; lat/lng are 0 and not plotted */
    gpsFix?: boolean
    /** 0/undefined = live fix; > 0 = last-known position this many seconds old */
    positionAgeS?: number
  }
  victimCount?: number
  aiBriefing: string
  recommendedUnitId: string
  status: IncidentStatus
  assignedUnitId?: string
  dispatchedAt?: string
}

export type ResponderRole = 'Search and Rescue' | 'Damage Assessment' | 'Relief Operations'

export type ResponderStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RESTING' | 'OFFLINE'

export interface FieldResponder {
  id: string
  name: string
  role: ResponderRole
  terminalType: 'TTGO_T_BEAM_V12'
  status: ResponderStatus
  batteryPercent: number
  batteryVoltage: number
  fatigueScore: number // 0-100%
  location: {
    lat: number
    lng: number
    accuracyMeters: number
    kalmanFiltered: boolean
    /** false = terminal has no GPS fix yet; lat/lng are not a real position */
    gpsFix?: boolean
    /** satellites used in the current fix (reported by terminal) */
    satellites?: number
    /** satellites visible to the receiver (search progress before a fix) */
    satellitesInView?: number
    /** false = terminal's GPS module is not sending any data */
    gpsModuleOk?: boolean
  }
  assignedIncidentId?: string
  lastSeen: string
  relayedReportsCount: number
}

export interface RoadHazard {
  id: string
  name: string
  type: 'FLOOD' | 'LANDSLIDE' | 'DEBRIS'
  lat: number
  lng: number
  penaltyMinutes: number
}

