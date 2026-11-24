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
    location: {
      lat: 10.3157,
      lng: 123.8854,
      accuracyMeters: 2.0,
      kalmanFiltered: true,
    },
    lastSeen: 'Connecting to LoRa...',
    relayedReportsCount: 0,
  },
]

export const INITIAL_INCIDENTS: IncidentReport[] = []

export const ROAD_HAZARDS: RoadHazard[] = []


