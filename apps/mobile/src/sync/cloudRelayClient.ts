import type { IncidentPayload } from '@salbar/protocol';
import type { LocalReport } from '../types/report';

export interface CloudUploadResult {
  ok: boolean;
  deduplicated?: boolean;
  error?: string;
}

interface CloudRelayBody extends IncidentPayload {
  incidentIdNum: number;
  accuracyMeters: number;
  posAgeS: number;
  createdAtUtc: number;
}

const REQUEST_TIMEOUT_MS = 8000;

export async function uploadReportToCloudRelay(
  report: LocalReport,
  baseUrl: string,
): Promise<CloudUploadResult> {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  if (!normalizedBase) {
    return { ok: false, error: 'Cloud Relay URL is empty.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const payload: CloudRelayBody = {
    id: report.id,
    incidentIdNum: report.incidentIdNum,
    urgency: report.urgency,
    category: report.category,
    source: 'CLOUD_RELAY',
    victimCount: report.victimCount,
    lat: report.lat,
    lng: report.lng,
    accuracyMeters: report.accuracyMeters,
    posAgeS: report.posAgeS,
    createdAtUtc: report.createdAtUtc,
    rawText: report.rawText,
  };

  try {
    const res = await fetch(`${normalizedBase}/api/v1/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (res.status === 200 || res.status === 201) {
      return { ok: true };
    }
    if (res.status === 409) {
      return { ok: true, deduplicated: true };
    }

    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Cloud Relay request timed out'
          : err.message
        : 'Network error';
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
