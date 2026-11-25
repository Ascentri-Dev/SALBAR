import type { IncidentPayload } from '@salbar/protocol';

export type IncidentCategory = IncidentPayload['category'];
export type IncidentUrgency = IncidentPayload['urgency'];

export type SyncStatus = 'PENDING_LOCAL' | 'SYNCING' | 'SENT_CLOUD' | 'RELAYED_BLE';
export type SyncPath = 'CLOUD_RELAY' | 'LORA_MESH_BLE' | null;

export interface LocalReport {
  id: string;
  incidentIdNum: number;
  category: IncidentCategory;
  urgency: IncidentUrgency;
  victimCount: number;
  rawText: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  posAgeS: number;
  createdAtUtc: number;
  syncStatus: SyncStatus;
  syncPath: SyncPath;
  retryCount: number;
  lastError: string | null;
}

export interface CreateReportInput {
  category: IncidentCategory;
  urgency: IncidentUrgency;
  victimCount: number;
  rawText: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  posAgeS: number;
}

export interface ReportCounts {
  pending: number;
  relayedBle: number;
  sentCloud: number;
  total: number;
}

export type GpsFixState = 'LOCKED' | 'SEARCHING' | 'LAST_KNOWN' | 'NO_FIX' | 'DENIED';

export interface GpsReading {
  lat: number;
  lng: number;
  accuracyMeters: number;
  posAgeS: number;
  fixState: GpsFixState;
  lastUpdatedMs: number | null;
}
