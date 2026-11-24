import type { IncidentReport, FieldResponder, RoadHazard } from '../types/cad'

export const INITIAL_RESPONDERS: FieldResponder[] = [
  {
    id: 'SAR-01',
    name: 'SAR Unit Alpha (SAR-01)',
    role: 'Search and Rescue',
    terminalType: 'TTGO_T_BEAM_V12',
    status: 'AVAILABLE',
    batteryPercent: 100,
    batteryVoltage: 4.12,
    fatigueScore: 0,
    // No position until the terminal reports a real GPS fix (0,0 = not plotted)
    location: {
      lat: 0,
      lng: 0,
      accuracyMeters: 0,
      kalmanFiltered: false,
      gpsFix: false,
    },
    lastSeen: 'Connecting to LoRa...',
    relayedReportsCount: 0,
  },
]

export const INITIAL_INCIDENTS: IncidentReport[] = []

export const ROAD_HAZARDS: RoadHazard[] = []


