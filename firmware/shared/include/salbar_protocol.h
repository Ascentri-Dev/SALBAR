#pragma once

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// ============================================================================
// SALBAR RF & LoRa Modulation Settings (915 MHz ISM Band)
// ============================================================================
#define SALBAR_LORA_FREQ_MHZ       915.0f
#define SALBAR_LORA_BW_KHZ         125.0f
#define SALBAR_LORA_SF             9
#define SALBAR_LORA_CR             7        // 4/7 Coding Rate
#define SALBAR_LORA_SYNC_WORD      0x12     // Private network sync word for SX1262
#define SALBAR_LORA_PREAMBLE_LEN   8
#define SALBAR_LORA_TX_POWER_DBM   22       // Max +22 dBm for SX1262
#define SALBAR_LORA_CURRENT_LIMIT  140.0f   // mA

#define SALBAR_PROTOCOL_MAGIC      0x5341   // 'S' 'A' (SALBAR)
#define SALBAR_PROTOCOL_VERSION    1

// ============================================================================
// Message Types
// ============================================================================
typedef enum {
    SALBAR_MSG_TELEMETRY = 0x01,  // Handheld terminal GPS, battery, health
    SALBAR_MSG_INCIDENT  = 0x02,  // Emergency assessment / citizen report
    SALBAR_MSG_DISPATCH  = 0x03,  // Commander downlink dispatch directive
    SALBAR_MSG_ACK       = 0x04   // Delivery confirmation
} SalbarMsgType;

// ============================================================================
// Enums matching Web Dashboard CAD types
// ============================================================================
typedef enum {
    SALBAR_URGENCY_LOW      = 0,
    SALBAR_URGENCY_MODERATE = 1,
    SALBAR_URGENCY_HIGH     = 2,
    SALBAR_URGENCY_CRITICAL = 3
} SalbarUrgency;

typedef enum {
    SALBAR_CAT_TRAPPED_PERSONS   = 0,
    SALBAR_CAT_MEDICAL_EMERGENCY = 1,
    SALBAR_CAT_FLOOD_INUNDATION  = 2,
    SALBAR_CAT_STRUCTURAL_DAMAGE = 3,
    SALBAR_CAT_LANDSLIDE_HAZARD  = 4,
    SALBAR_CAT_RELIEF_SUPPLIES   = 5
} SalbarCategory;

typedef enum {
    SALBAR_STATUS_AVAILABLE = 0,
    SALBAR_STATUS_EN_ROUTE  = 1,
    SALBAR_STATUS_ON_SCENE  = 2,
    SALBAR_STATUS_RESTING   = 3,
    SALBAR_STATUS_OFFLINE   = 4
} SalbarResponderStatus;

typedef enum {
    SALBAR_SRC_LORA_DIRECT   = 0,
    SALBAR_SRC_LORA_MESH_BLE = 1,
    SALBAR_SRC_CLOUD_RELAY   = 2
} SalbarReportSource;

// ============================================================================
// Bit-Packed Packet Structures
// ============================================================================
#define SALBAR_NO_TIME 0xFFFFFFFFUL
#define SALBAR_POS_NONE 0xFFFFU

#pragma pack(push, 1)

// Standard 10-byte Header
typedef struct {
    uint16_t magic;          // SALBAR_PROTOCOL_MAGIC (0x5341)
    uint8_t  version;        // SALBAR_PROTOCOL_VERSION
    uint8_t  msg_type;       // SalbarMsgType
    uint16_t seq_num;        // Monotonically increasing sequence number
    char     src_node[6];    // e.g. "SAR-01", "DA-02", "GATEWY"
    char     dest_node[6];   // Destination e.g. "GATEWY" or "SAR-01"
} SalbarHeader;

// MSG_TELEMETRY Payload (~19 bytes)
typedef struct {
    int32_t  lat_e7;         // Latitude * 1e7 (e.g., 10.3150000 -> 103150000)
    int32_t  lng_e7;         // Longitude * 1e7
    uint16_t accuracy_cm;    // Accuracy in centimeters (Kalman smoothed)
    uint16_t battery_mv;     // Battery voltage in millivolts (e.g. 3950 mV)
    uint8_t  battery_pct;    // 0 - 100%
    uint8_t  status;         // SalbarResponderStatus
    uint8_t  fatigue_score;  // 0 - 100%
    uint8_t  relayed_count;  // Count of BLE reports forwarded
    uint8_t  flags;          // Bit 0: GPS fix, Bit 1: GPS module streaming, Bits 2-7: satellites used
    uint8_t  sats_in_view;   // Satellites visible (from NMEA GSV), shows search progress before a fix
    uint8_t  sats_tracked;   // Satellites with a measurable signal (GSV SNR > 0)
    uint8_t  sats_strong;    // Satellites with SNR >= 30 dB-Hz (usable for a quick fix)
    uint8_t  max_snr;        // Strongest satellite signal, dB-Hz (0 = none)
    uint8_t  gps_receiver;   // Module's own fix report: bits 0-1 GSA mode (0 unknown,1 none,2 2D,3 3D),
                             // bit 2 RMC status 'A', bits 3-5 GGA fix quality (0-7)
    uint8_t  ubx_eph;        // u-blox NAV-SVINFO: satellites with ephemeris downloaded (0xFF = no UBX reply)
    uint8_t  ubx_locked;     // satellites with code+time lock (quality >= 4)
    uint8_t  ubx_used;       // satellites used in navigation solution
} SalbarTelemetryPayload;

// MSG_INCIDENT Payload (~150 bytes max)
typedef struct {
    uint16_t incident_id_num; // Numeric ID (e.g. 1 -> INC-2026-001)
    uint8_t  urgency;         // SalbarUrgency
    uint8_t  category;        // SalbarCategory
    uint8_t  source;          // SalbarReportSource
    uint8_t  victim_count;    // Estimated victim count
    int32_t  lat_e7;          // Incident latitude * 1e7
    int32_t  lng_e7;          // Incident longitude * 1e7
    uint32_t sent_utc_ms;     // GPS UTC time of the Send press, ms since UTC midnight
                              // (SALBAR_NO_TIME = GPS time unknown). Used to measure delivery delay.
    uint16_t pos_age_s;       // 0 = live fix; 1-65534 = last-known position this many seconds old;
                              // SALBAR_POS_NONE = no position at all (lat/lng = 0)
    uint8_t  text_len;        // Length of raw text
    char     raw_text[128];   // Raw civilian or field text (Cebuano/Tagalog/English)
} SalbarIncidentPayload;

// MSG_DISPATCH Downlink Payload (~50 bytes)
typedef struct {
    uint16_t incident_id_num; // Target incident
    char     target_node[6];  // e.g. "SAR-01"
    uint8_t  command_code;    // 0 = ASSIGN, 1 = STANDBY, 2 = CANCEL
    int32_t  dest_lat_e7;     // GPS destination latitude * 1e7
    int32_t  dest_lng_e7;     // GPS destination longitude * 1e7
    char     brief_notes[32]; // Short instruction for OLED
} SalbarDispatchPayload;

#pragma pack(pop)

// Simple CCITT CRC16 calculation for packet validation
static inline uint16_t salbar_crc16(const uint8_t *data, size_t len) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    return crc;
}

#ifdef __cplusplus
}
#endif
