/**
 * SALBAR Universal Protocol & Schema Definitions
 * Shared across Embedded C Firmware, Python Serial Bridge, and React Web Dashboard.
 */

export const LORA_CONFIG = {
  FREQUENCY_MHZ: 915.0,
  BANDWIDTH_KHZ: 125.0,
  SPREADING_FACTOR: 9,
  CODING_RATE: 7, // 4/7
  SYNC_WORD: 0x12,
  TX_POWER_DBM: 22,
} as const

export enum MessageType {
  TELEMETRY = 'TELEMETRY',
  INCIDENT = 'INCIDENT',
  DISPATCH = 'DISPATCH',
  GATEWAY_STATUS = 'GATEWAY_STATUS',
  DOWNLINK_ACK = 'DOWNLINK_ACK',
}

export interface TelemetryPayload {
  id: string
  lat: number
  lng: number
  accuracyMeters: number
  kalmanFiltered: boolean
  batteryVoltage: number
  batteryPercent: number
  status: 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RESTING' | 'OFFLINE'
  fatigueScore: number
  relayedReportsCount: number
}

export interface IncidentPayload {
  id: string
  urgency: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  category:
    | 'trapped-persons'
    | 'medical-emergency'
    | 'flood-inundation'
    | 'structural-collapse'
    | 'landslide-hazard'
    | 'relief-supplies'
  source: 'LORA_DIRECT' | 'LORA_MESH_BLE' | 'CLOUD_RELAY'
  victimCount?: number
  lat: number
  lng: number
  rawText: string
}

export interface DispatchCommand {
  cmd: 'DISPATCH'
  targetUnit: string
  incidentIdNum: number
  actionCode: number // 0 = ASSIGN, 1 = STANDBY, 2 = CANCEL
  lat?: number
  lng?: number
  notes?: string
}

export interface GatewayStatusMessage {
  type: 'GATEWAY_STATUS'
  connected: boolean
  port: string
  timestamp: number
  error?: string
}
