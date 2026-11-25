import type { IncidentCategory, IncidentUrgency, LocalReport } from '../types/report';

/**
 * Binary frame serializer matching firmware/shared/include/salbar_protocol.h.
 * Produces: SalbarHeader (18 bytes) + SalbarIncidentPayload (145 bytes) + CRC16 (2 bytes) = 165 bytes.
 */
const PROTOCOL_MAGIC = 0x5341; // 'SA'
const PROTOCOL_VERSION = 1;
const MSG_TYPE_INCIDENT = 0x02;
const SRC_LORA_MESH_BLE = 1;
const NO_TIME = 0xffffffff;
const HEADER_LEN = 18;
const PAYLOAD_LEN = 145;
const TOTAL_FRAME_LEN = HEADER_LEN + PAYLOAD_LEN + 2;

const URGENCY_CODE: Record<IncidentUrgency, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const CATEGORY_CODE: Record<IncidentCategory, number> = {
  'trapped-persons': 0,
  'medical-emergency': 1,
  'flood-inundation': 2,
  'structural-collapse': 3,
  'landslide-hazard': 4,
  'relief-supplies': 5,
};

function writeFixedAscii(view: Uint8Array, offset: number, text: string, len: number): void {
  for (let i = 0; i < len; i++) {
    view[offset + i] = i < text.length ? text.charCodeAt(i) & 0x7f : 0;
  }
}

function encodeUtf8Bytes(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(++i);
      code = 0x10000 + (((code & 0x3ff) << 10) | (next & 0x3ff));
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(out);
}

/**
 * CCITT CRC16 matching salbar_crc16() in salbar_protocol.h.
 */
export function computeSalbarCrc16(data: Uint8Array, length: number): number {
  let crc = 0xffff;
  for (let i = 0; i < length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

export function encodeIncidentBinaryFrame(
  report: LocalReport,
  seqNum: number = 1,
): Uint8Array {
  const buffer = new ArrayBuffer(TOTAL_FRAME_LEN);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // SalbarHeader (18 bytes, packed little-endian)
  view.setUint16(0, PROTOCOL_MAGIC, true);
  view.setUint8(2, PROTOCOL_VERSION);
  view.setUint8(3, MSG_TYPE_INCIDENT);
  view.setUint16(4, seqNum & 0xffff, true);
  writeFixedAscii(bytes, 6, 'MOBILE', 6);
  writeFixedAscii(bytes, 12, 'GATEWY', 6);

  // SalbarIncidentPayload (starts at offset 18)
  const p = HEADER_LEN;
  view.setUint16(p + 0, report.incidentIdNum & 0xffff, true);
  view.setUint8(p + 2, URGENCY_CODE[report.urgency]);
  view.setUint8(p + 3, CATEGORY_CODE[report.category]);
  view.setUint8(p + 4, SRC_LORA_MESH_BLE);
  view.setUint8(p + 5, Math.min(255, Math.max(0, report.victimCount)));
  view.setInt32(p + 6, Math.round(report.lat * 1e7), true);
  view.setInt32(p + 10, Math.round(report.lng * 1e7), true);

  // ms since UTC midnight
  const d = new Date(report.createdAtUtc);
  const utcMsOfDay =
    ((d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) * 1000 +
      d.getUTCMilliseconds()) >>>
    0;
  view.setUint32(p + 14, report.createdAtUtc > 0 ? utcMsOfDay : NO_TIME, true);
  view.setUint16(p + 18, Math.min(65535, Math.max(0, report.posAgeS)), true);

  const utf8 = encodeUtf8Bytes(report.rawText);
  const textLen = Math.min(124, utf8.length);
  view.setUint8(p + 20, textLen);
  for (let i = 0; i < textLen; i++) {
    bytes[p + 21 + i] = utf8[i];
  }

  // Trailing CRC16 over header + payload
  const crc = computeSalbarCrc16(bytes, HEADER_LEN + PAYLOAD_LEN);
  view.setUint16(HEADER_LEN + PAYLOAD_LEN, crc, true);

  return bytes;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function uint8ToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64_CHARS[(triple >> 18) & 0x3f];
    out += B64_CHARS[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? B64_CHARS[(triple >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? B64_CHARS[triple & 0x3f] : '=';
  }
  return out;
}

export function base64ToUint8(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i]);
    const c1 = B64_CHARS.indexOf(clean[i + 1]);
    const c2 = i + 2 < clean.length ? B64_CHARS.indexOf(clean[i + 2]) : -1;
    const c3 = i + 3 < clean.length ? B64_CHARS.indexOf(clean[i + 3]) : -1;
    out.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) out.push(((c1 & 0x0f) << 4) | (c2 >> 2));
    if (c3 >= 0) out.push(((c2 & 0x03) << 6) | c3);
  }
  return new Uint8Array(out);
}
