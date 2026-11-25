import * as Crypto from 'expo-crypto';
import type {
  CreateReportInput,
  LocalReport,
  ReportCounts,
  SyncPath,
  SyncStatus,
} from '../types/report';
import { MAX_RAW_TEXT_BYTES, truncateToUtf8Bytes } from '../utils/utf8';
import { getDatabase } from './database';

interface ReportRow {
  id: string;
  incident_id_num: number;
  category: LocalReport['category'];
  urgency: LocalReport['urgency'];
  victim_count: number;
  raw_text: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  pos_age_s: number;
  created_at_utc: number;
  sync_status: SyncStatus;
  sync_path: SyncPath;
  retry_count: number;
  last_error: string | null;
}

function mapRow(row: ReportRow): LocalReport {
  return {
    id: row.id,
    incidentIdNum: row.incident_id_num,
    category: row.category,
    urgency: row.urgency,
    victimCount: row.victim_count,
    rawText: row.raw_text,
    lat: row.lat,
    lng: row.lng,
    accuracyMeters: row.accuracy_m,
    posAgeS: row.pos_age_s,
    createdAtUtc: row.created_at_utc,
    syncStatus: row.sync_status,
    syncPath: row.sync_path,
    retryCount: row.retry_count,
    lastError: row.last_error,
  };
}

/**
 * Derives a non-zero 16-bit numeric ID (1..65535) for LoRa binary framing.
 */
function generateIncidentIdNum(): number {
  const bytes = Crypto.getRandomBytes(2);
  const raw = ((bytes[0] << 8) | bytes[1]) & 0xffff;
  return raw === 0 ? 1 : raw;
}

export async function createReport(input: CreateReportInput): Promise<LocalReport> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const incidentIdNum = generateIncidentIdNum();
  const createdAtUtc = Date.now();
  // Strip control characters and enforce 128-byte UTF-8 LoRa payload limit
  const cleanedText = input.rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();
  const safeText = truncateToUtf8Bytes(cleanedText, MAX_RAW_TEXT_BYTES);
  const safeVictims = Math.max(0, Math.min(999, Math.round(input.victimCount)));

  await db.runAsync(
    `INSERT INTO reports (
      id, incident_id_num, category, urgency, victim_count, raw_text,
      lat, lng, accuracy_m, pos_age_s, created_at_utc,
      sync_status, sync_path, retry_count, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_LOCAL', NULL, 0, NULL)`,
    [
      id,
      incidentIdNum,
      input.category,
      input.urgency,
      safeVictims,
      safeText,
      input.lat,
      input.lng,
      input.accuracyMeters,
      input.posAgeS,
      createdAtUtc,
    ],
  );

  return {
    id,
    incidentIdNum,
    category: input.category,
    urgency: input.urgency,
    victimCount: safeVictims,
    rawText: safeText,
    lat: input.lat,
    lng: input.lng,
    accuracyMeters: input.accuracyMeters,
    posAgeS: input.posAgeS,
    createdAtUtc,
    syncStatus: 'PENDING_LOCAL',
    syncPath: null,
    retryCount: 0,
    lastError: null,
  };
}

export async function listReports(): Promise<LocalReport[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReportRow>(
    'SELECT * FROM reports ORDER BY created_at_utc DESC',
  );
  return rows.map(mapRow);
}

export async function listPendingReports(): Promise<LocalReport[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReportRow>(
    `SELECT * FROM reports
     WHERE sync_status IN ('PENDING_LOCAL', 'SYNCING')
     ORDER BY created_at_utc ASC`,
  );
  return rows.map(mapRow);
}

export async function getReportCounts(): Promise<ReportCounts> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    pending: number | null;
    relayed_ble: number | null;
    sent_cloud: number | null;
    total: number | null;
  }>(`
    SELECT
      SUM(CASE WHEN sync_status IN ('PENDING_LOCAL', 'SYNCING') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN sync_status = 'RELAYED_BLE' THEN 1 ELSE 0 END) AS relayed_ble,
      SUM(CASE WHEN sync_status = 'SENT_CLOUD' THEN 1 ELSE 0 END) AS sent_cloud,
      COUNT(*) AS total
    FROM reports
  `);

  return {
    pending: row?.pending ?? 0,
    relayedBle: row?.relayed_ble ?? 0,
    sentCloud: row?.sent_cloud ?? 0,
    total: row?.total ?? 0,
  };
}

export async function updateReportSyncStatus(
  id: string,
  syncStatus: SyncStatus,
  syncPath: SyncPath,
  lastError: string | null = null,
  incrementRetry: boolean = false,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE reports
     SET sync_status = ?,
         sync_path = ?,
         last_error = ?,
         retry_count = retry_count + ?
     WHERE id = ?`,
    [syncStatus, syncPath, lastError, incrementRetry ? 1 : 0, id],
  );
}

export async function deleteReport(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM reports WHERE id = ?', [id]);
}
