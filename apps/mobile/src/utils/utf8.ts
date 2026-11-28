/**
 * UTF-8 byte helpers matching SalbarIncidentPayload.raw_text[128] in salbar_protocol.h.
 */
export const MAX_RAW_TEXT_BYTES = 128;

export function getUtf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // Surrogate pair (4 UTF-8 bytes)
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export function truncateToUtf8Bytes(text: string, maxBytes: number = MAX_RAW_TEXT_BYTES): string {
  let bytes = 0;
  let end = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let charBytes = 1;
    let step = 1;
    if (code < 0x80) {
      charBytes = 1;
    } else if (code < 0x800) {
      charBytes = 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      charBytes = 4;
      step = 2;
    } else {
      charBytes = 3;
    }

    if (bytes + charBytes > maxBytes) {
      break;
    }
    bytes += charBytes;
    end = i + step;
    if (step === 2) {
      i++;
    }
  }
  return text.slice(0, end);
}
