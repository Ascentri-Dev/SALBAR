/**
 * SALBAR Handheld Field Terminal Firmware
 * Target Board: LilyGO TTGO T-Beam V1.1 / V1.2 (ESP32 + SX1276 915MHz + NEO-6M)
 *
 * Functions:
 * 1. Initializes AXP192 / AXP2101 PMU to power NEO-6M GNSS, LoRa, and OLED.
 * 2. Reads NEO-6M NMEA stream and smooths coordinates via a recursive Kalman Filter.
 * 3. Transmits periodic SALBAR_MSG_TELEMETRY packets over 915 MHz LoRa to GATEWY.
 * 4. Sends SALBAR_MSG_INCIDENT quick-triage alerts on user button press (GPIO 38) or Serial CLI.
 * 5. Listens for SALBAR_MSG_DISPATCH downlinks from GATEWY and displays orders on OLED.
 */

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <HardwareSerial.h>
#include <stdarg.h>
#include <RadioLib.h>
#include <TinyGPSPlus.h>
#include <XPowersLib.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>   // 1.3" OLED uses SH1106 controller

#include "pins_config.h"
#include "kalman_gps.h"
#include "salbar_protocol.h"

// ============================================================================
// Peripherals & Radio Instances
// ============================================================================
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1

// 100 kHz during and after transfers: loose breadboard jumpers corrupt 400 kHz I2C
// (symptom: first rows OK, rest noise).
static Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET,
                                100000UL, 100000UL);
static bool oledReady = false;

static SX1276 radio = new Module(LORA_NSS, LORA_DIO0, LORA_RST, LORA_DIO1);
static bool radioReady = false;

static TinyGPSPlus gps;
static HardwareSerial gpsSerial(1);
static KalmanGPS kalmanGps(1.5f);

enum class PmuType { NONE, AXP192, AXP2101 };
static PmuType pmuType = PmuType::NONE;
static XPowersAXP192 pmu192;
static XPowersAXP2101 pmu2101;

// ============================================================================
// Runtime State
// ============================================================================
static volatile bool rxFlag = false;
static uint16_t txSeqNum = 0;
static uint16_t nextIncidentNum = 1;
static uint32_t txCount = 0;
static uint32_t rxCount = 0;
static uint32_t lastTelemetryMs = 0;
static uint32_t lastDisplayMs = 0;
static uint32_t lastBtnPressMs = 0;

// ----------------------------------------------------------------------------
// GPS fix state helpers
// No fake/fallback coordinates are ever transmitted: without a fresh fix the
// terminal sends lat/lng = 0 and clears the fix flag, so the gateway and
// dashboard can show "GPS ACQUIRING" instead of a wrong pin.
// ----------------------------------------------------------------------------
// Live fix = a measurement accepted into the filter within this window. 15 s rides
// out short dropouts (walking past a wall or tree) without calling the fix lost.
static constexpr uint32_t GPS_FIX_MAX_AGE_MS  = 15000;
// Jump filter: a reading this far from the filtered position (plus 3 m/s walking
// allowance over the gap) is held back until it repeats; NEO-6M fixes right after
// re-acquiring can be hundreds of meters off.
static constexpr float    GPS_JUMP_LIMIT_M    = 100.0f;
static constexpr float    GPS_WALK_SPEED_MPS  = 3.0f;
static constexpr uint8_t  GPS_JUMP_CONFIRM    = 5;      // consistent readings (~5 s) to accept a jump
static constexpr float    GPS_MAX_HDOP        = 5.0f;   // ignore very poor geometry
static uint32_t gpsLastAcceptedMs = 0;
static uint8_t  gpsJumpCount = 0;
static double   gpsJumpLat = 0.0, gpsJumpLng = 0.0;
static constexpr uint32_t GPS_DATA_TIMEOUT_MS = 3000;  // no NMEA bytes for this long = module silent
static uint32_t gpsLastCharMs = 0;
static uint32_t gpsLastCharCount = 0;
static bool     gpsLastFixState = false;
static bool     gpsLastDataState = false;

// Telemetry flags byte layout (SalbarTelemetryPayload.flags)
//   bit 0    : 1 = valid fresh GPS fix (coordinates are Kalman filtered)
//   bit 1    : 1 = GPS module is streaming NMEA data
//   bits 2-7 : satellites used in fix (0-63)
#define TELEM_FLAG_GPS_FIX   0x01
#define TELEM_FLAG_GPS_DATA  0x02

static bool gpsHasFix() {
    return kalmanGps.isInitialized() && gpsLastAcceptedMs != 0 &&
           (millis() - gpsLastAcceptedMs) < GPS_FIX_MAX_AGE_MS;
}

// Last-known position: the filter keeps the last good position after the fix is lost.
static bool gpsHasLastKnown() {
    return kalmanGps.isInitialized() && gpsLastAcceptedMs != 0;
}

static uint32_t gpsPositionAgeS() {
    return gpsHasLastKnown() ? (millis() - gpsLastAcceptedMs) / 1000UL : 0;
}

static float approxDistanceM(double lat1, double lng1, double lat2, double lng2) {
    double x = (lng2 - lng1) * DEG_TO_RAD * cos((lat1 + lat2) * 0.5 * DEG_TO_RAD);
    double y = (lat2 - lat1) * DEG_TO_RAD;
    return (float)(sqrt(x * x + y * y) * 6371000.0);
}

// Feed one GPS reading through the HDOP gate and jump filter into the Kalman filter.
static void gpsFeedMeasurement(double lat, double lng, float hdop) {
    if (hdop > GPS_MAX_HDOP) return;
    uint32_t now = millis();

    if (kalmanGps.isInitialized()) {
        float dist = approxDistanceM(kalmanGps.lat(), kalmanGps.lng(), lat, lng);
        float gapS = (now - gpsLastAcceptedMs) / 1000.0f;
        float limit = GPS_JUMP_LIMIT_M + GPS_WALK_SPEED_MPS * gapS;
        if (dist > limit) {
            bool sameJump = gpsJumpCount > 0 &&
                            approxDistanceM(gpsJumpLat, gpsJumpLng, lat, lng) < 30.0f;
            gpsJumpCount = sameJump ? gpsJumpCount + 1 : 1;
            gpsJumpLat = lat;
            gpsJumpLng = lng;
            if (gpsJumpCount < GPS_JUMP_CONFIRM) return;   // hold back until it repeats
            Serial.printf("[GPS] Position moved %.0f m and held for %u readings, accepting\n",
                          dist, gpsJumpCount);
            kalmanGps.reset();
        } else if (now - gpsLastAcceptedMs > GPS_FIX_MAX_AGE_MS) {
            kalmanGps.reset();   // fix was lost; start fresh instead of dragging the old estimate
        }
    }
    gpsJumpCount = 0;
    kalmanGps.update(lat, lng, hdop * 2.5f);
    gpsLastAcceptedMs = now;
}

static bool gpsModuleStreaming() {
    return gpsLastCharMs != 0 && (millis() - gpsLastCharMs) < GPS_DATA_TIMEOUT_MS;
}

static uint8_t gpsSatellites() {
    if (!gps.satellites.isValid()) return 0;
    uint32_t n = gps.satellites.value();
    return n > 63 ? 63 : (uint8_t)n;
}

static float gpsAccuracyMeters() {
    return kalmanGps.accuracyCm() / 100.0f;
}

// ----------------------------------------------------------------------------
// Satellites in view (NMEA GSV sentences)
// GSV field 3 = total satellites in view for that constellation. Many modules
// ship with GSV disabled, so gpsEnableGsv() asks for it at boot using both the
// u-blox ($PUBX,40) and CASIC/L76K ($PCAS03) commands; the module ignores the
// one it does not understand.
// ----------------------------------------------------------------------------
static TinyGPSCustom gsvGP(gps, "GPGSV", 3);  // GPS
static TinyGPSCustom gsvGL(gps, "GLGSV", 3);  // GLONASS
static TinyGPSCustom gsvGA(gps, "GAGSV", 3);  // Galileo
static TinyGPSCustom gsvGB(gps, "GBGSV", 3);  // BeiDou
static TinyGPSCustom gsvBD(gps, "BDGSV", 3);  // BeiDou (alt talker)

// Receiver's own fix status, straight from NMEA (independent of our fix logic)
static TinyGPSCustom gsaModeGP(gps, "GPGSA", 2);  // 1 = no fix, 2 = 2D, 3 = 3D
static TinyGPSCustom gsaModeGN(gps, "GNGSA", 2);
static TinyGPSCustom rmcStatGP(gps, "GPRMC", 2);  // A = valid, V = invalid
static TinyGPSCustom rmcStatGN(gps, "GNRMC", 2);
static TinyGPSCustom ggaQualGP(gps, "GPGGA", 6);  // 0 = invalid, 1 = GPS, 2 = DGPS, 6 = estimated
static TinyGPSCustom ggaQualGN(gps, "GNGGA", 6);

static const char *customValue(TinyGPSCustom &a, TinyGPSCustom &b) {
    if (a.isValid() && a.age() < GPS_FIX_MAX_AGE_MS) return a.value();
    if (b.isValid() && b.age() < GPS_FIX_MAX_AGE_MS) return b.value();
    return "";
}

static uint8_t gpsReceiverStatus() {
    const char *mode = customValue(gsaModeGP, gsaModeGN);
    const char *rmc = customValue(rmcStatGP, rmcStatGN);
    const char *qual = customValue(ggaQualGP, ggaQualGN);
    uint8_t m = mode[0] ? (uint8_t)(atoi(mode) & 0x03) : 0;
    uint8_t a = (rmc[0] == 'A') ? 1 : 0;
    uint8_t q = qual[0] ? (uint8_t)(atoi(qual) & 0x07) : 0;
    return (uint8_t)(m | (a << 2) | (q << 3));
}

// u-blox UBX: restore factory configuration, then GNSS-only hot restart
// (keeps downloaded satellite data). Used by the serial 'R' command.
static void gpsSendUbx(uint8_t cls, uint8_t id, const uint8_t *payload, uint16_t len);
static void gpsFactoryReset();
static uint8_t  gsvEnableAttempts = 0;
static uint32_t gsvLastAttemptMs = 0;

static uint8_t gsvCount(TinyGPSCustom &c) {
    if (!c.isValid() || c.age() > GPS_FIX_MAX_AGE_MS) return 0;
    return (uint8_t)atoi(c.value());
}

static uint8_t gpsSatsInView() {
    uint16_t n = gsvCount(gsvGP) + gsvCount(gsvGL) + gsvCount(gsvGA) +
                 gsvCount(gsvGB) + gsvCount(gsvBD);
    return n > 255 ? 255 : (uint8_t)n;
}

static bool gpsHasGsv() {
    return gsvGP.isValid() || gsvGL.isValid() || gsvGA.isValid() ||
           gsvGB.isValid() || gsvBD.isValid();
}

// ----------------------------------------------------------------------------
// GSV signal-strength parser
// TinyGPSPlus keeps only the last GSV sentence, but a full sky report spans
// several sentences (4 satellites each). This small parser collects one full
// GSV cycle per constellation and keeps: satellites with any signal, satellites
// with a strong signal (>= 30 dB-Hz), and the strongest SNR.
// ----------------------------------------------------------------------------
static constexpr uint8_t GSV_STRONG_SNR = 30;
static constexpr uint8_t GSV_TALKERS = 5;  // GP, GL, GA, GB, BD
struct GsvStats {
    uint8_t  tracked, strong, maxSnr;       // in-progress cycle
    uint8_t  doneTracked, doneStrong, doneMaxSnr;
    uint32_t doneMs;
};
static GsvStats gsvStats[GSV_TALKERS] = {};
static char     nmeaLine[100];
static uint8_t  nmeaLen = 0;

static int gsvTalkerIndex(const char *t) {
    if (t[0] == 'G' && t[1] == 'P') return 0;
    if (t[0] == 'G' && t[1] == 'L') return 1;
    if (t[0] == 'G' && t[1] == 'A') return 2;
    if (t[0] == 'G' && t[1] == 'B') return 3;
    if (t[0] == 'B' && t[1] == 'D') return 4;
    return -1;
}

static void gsvParseLine(char *line) {
    // line looks like: $GPGSV,3,1,11,05,45,123,38,07,...*7A
    if (line[0] != '$' || strncmp(line + 3, "GSV,", 4) != 0) return;
    int ti = gsvTalkerIndex(line + 1);
    if (ti < 0) return;
    char *star = strchr(line, '*');
    if (star) *star = '\0';

    // Split into fields, keeping empty ones (strtok would skip them)
    char *fields[24];
    int n = 0;
    char *p = line;
    while (n < 24) {
        fields[n++] = p;
        char *c = strchr(p, ',');
        if (!c) break;
        *c = '\0';
        p = c + 1;
    }
    if (n < 4) return;
    int totalMsgs = atoi(fields[1]);
    int msgNum = atoi(fields[2]);
    GsvStats &st = gsvStats[ti];
    if (msgNum == 1) { st.tracked = 0; st.strong = 0; st.maxSnr = 0; }

    // Satellite blocks start at field 4: PRN, elevation, azimuth, SNR
    for (int i = 4; i + 3 < n; i += 4) {
        int snr = fields[i + 3][0] ? atoi(fields[i + 3]) : 0;
        if (snr > 0) {
            st.tracked++;
            if (snr >= GSV_STRONG_SNR) st.strong++;
            if (snr > st.maxSnr) st.maxSnr = (uint8_t)snr;
        }
    }
    if (msgNum == totalMsgs) {
        st.doneTracked = st.tracked;
        st.doneStrong = st.strong;
        st.doneMaxSnr = st.maxSnr;
        st.doneMs = millis();
    }
}

static void gsvFeed(char c) {
    if (c == '$') nmeaLen = 0;
    if (c == '\r' || c == '\n') {
        if (nmeaLen > 0) {
            nmeaLine[nmeaLen] = '\0';
            gsvParseLine(nmeaLine);
        }
        nmeaLen = 0;
        return;
    }
    if (nmeaLen < sizeof(nmeaLine) - 1) nmeaLine[nmeaLen++] = c;
}

static void gsvTotals(uint8_t &tracked, uint8_t &strong, uint8_t &maxSnr) {
    tracked = strong = maxSnr = 0;
    for (uint8_t i = 0; i < GSV_TALKERS; i++) {
        const GsvStats &st = gsvStats[i];
        if (st.doneMs == 0 || millis() - st.doneMs > GPS_FIX_MAX_AGE_MS) continue;
        tracked += st.doneTracked;
        strong += st.doneStrong;
        if (st.doneMaxSnr > maxSnr) maxSnr = st.doneMaxSnr;
    }
}

static void gpsSendNmeaCommand(const char *body) {
    uint8_t cs = 0;
    for (const char *p = body; *p; p++) cs ^= (uint8_t)*p;
    gpsSerial.printf("$%s*%02X\r\n", body, cs);
}

// ----------------------------------------------------------------------------
// u-blox NAV-SVINFO diagnostics
// Polled every 5 s. Tells us, per satellite, whether the module has finished
// downloading its ephemeris (needed for a fix), whether it is code/time locked,
// and whether it is used in the solution. No reply at all means the module does
// not speak UBX (non-genuine or non-u-blox chip).
// ----------------------------------------------------------------------------
static constexpr uint32_t UBX_POLL_MS = 5000;
static uint32_t ubxLastPollMs = 0;
static uint32_t ubxLastSvinfoMs = 0;
static uint8_t  ubxEph = 0, ubxLocked = 0, ubxUsed = 0, ubxNumCh = 0;
static uint32_t ubxFramesOk = 0;

static uint8_t  ubxBuf[520];
static uint16_t ubxPos = 0, ubxLen = 0;
static uint8_t  ubxState = 0;  // 0 sync1, 1 sync2, 2 header+payload+checksum

static void ubxHandleFrame(uint8_t cls, uint8_t id, const uint8_t *p, uint16_t len) {
    ubxFramesOk++;
    if (cls == 0x01 && id == 0x30 && len >= 8) {  // NAV-SVINFO
        uint8_t numCh = p[4];
        uint8_t eph = 0, locked = 0, used = 0;
        for (uint8_t i = 0; i < numCh && 8 + (i + 1) * 12 <= len; i++) {
            const uint8_t *ch = p + 8 + i * 12;
            uint8_t flags = ch[2];
            uint8_t quality = ch[3] & 0x0F;
            if (flags & 0x01) used++;          // svUsed
            if (flags & 0x08) eph++;           // orbitEph: ephemeris available
            if (quality >= 4) locked++;        // code locked + time synchronized
        }
        ubxNumCh = numCh;
        ubxEph = eph;
        ubxLocked = locked;
        ubxUsed = used;
        ubxLastSvinfoMs = millis();
    }
}

static void ubxFeed(uint8_t c) {
    switch (ubxState) {
        case 0:
            if (c == 0xB5) ubxState = 1;
            break;
        case 1:
            if (c == 0x62) { ubxState = 2; ubxPos = 0; ubxLen = 0; }
            else ubxState = (c == 0xB5) ? 1 : 0;
            break;
        case 2:
            ubxBuf[ubxPos++] = c;
            if (ubxPos == 4) {
                ubxLen = ubxBuf[2] | (ubxBuf[3] << 8);
                if (ubxLen + 6 > sizeof(ubxBuf)) { ubxState = 0; break; }
            }
            if (ubxPos >= 4 && ubxPos == ubxLen + 6) {
                uint8_t ckA = 0, ckB = 0;
                for (uint16_t i = 0; i < ubxLen + 4; i++) { ckA += ubxBuf[i]; ckB += ckA; }
                if (ckA == ubxBuf[ubxLen + 4] && ckB == ubxBuf[ubxLen + 5]) {
                    ubxHandleFrame(ubxBuf[0], ubxBuf[1], ubxBuf + 4, ubxLen);
                }
                ubxState = 0;
            }
            break;
    }
}

static bool ubxSvinfoFresh() {
    return ubxLastSvinfoMs != 0 && millis() - ubxLastSvinfoMs < 3 * UBX_POLL_MS;
}

static void gpsSendUbx(uint8_t cls, uint8_t id, const uint8_t *payload, uint16_t len) {
    uint8_t ckA = 0, ckB = 0;
    uint8_t hdr[4] = {cls, id, (uint8_t)(len & 0xFF), (uint8_t)(len >> 8)};
    gpsSerial.write(0xB5);
    gpsSerial.write(0x62);
    for (uint8_t b : hdr) { gpsSerial.write(b); ckA += b; ckB += ckA; }
    for (uint16_t i = 0; i < len; i++) { gpsSerial.write(payload[i]); ckA += payload[i]; ckB += ckA; }
    gpsSerial.write(ckA);
    gpsSerial.write(ckB);
}

static void gpsFactoryReset() {
    // CFG-CFG: clear all config sections, then load defaults (BBR + flash + EEPROM)
    const uint8_t cfgClear[13] = {0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                                  0xFF, 0xFF, 0x00, 0x00, 0x07};
    gpsSendUbx(0x06, 0x09, cfgClear, sizeof(cfgClear));
    delay(200);
    // CFG-RST: navBbrMask 0x0000 (hot start, keep ephemeris), resetMode 0x02 (GNSS only)
    const uint8_t rst[4] = {0x00, 0x00, 0x02, 0x00};
    gpsSendUbx(0x06, 0x04, rst, sizeof(rst));
    delay(500);
    gsvEnableAttempts = 0;  // re-enable GSV in case defaults differ
}

static void gpsEnableGsv() {
    gpsSendNmeaCommand("PUBX,40,GSV,0,1,0,0,0,0");                 // u-blox: GSV every fix on UART1
    gpsSendNmeaCommand("PCAS03,1,0,1,1,1,0,0,0,0,0,,,0,0");          // CASIC/L76K: GGA,GSA,GSV,RMC on
    gsvEnableAttempts++;
    gsvLastAttemptMs = millis();
}

static char activeDispatchNote[33] = "STANDBY - NO ORDERS";
static uint16_t activeDispatchInc = 0;
static uint8_t currentStatus = SALBAR_STATUS_AVAILABLE;

// ============================================================================
// 4-Button Field Triage UI State Machine
// ============================================================================
enum class UiScreen {
    STATUS_TELEMETRY = 0,
    TRIAGE_CATEGORY  = 1,
    TRIAGE_URGENCY   = 2,
    INCIDENT_CONFIRM = 3
};

static const char *TRIAGE_CATEGORIES[] = {
    "Trapped Persons",
    "Medical Emerg.",
    "Flood Inundation",
    "Structural Damage",
    "Landslide Hazard",
    "Relief Supplies"
};
static constexpr uint8_t NUM_CATEGORIES = 6;

static const char *URGENCY_LEVELS[] = {
    "LOW",
    "MODERATE",
    "HIGH",
    "CRITICAL"
};
static constexpr uint8_t NUM_URGENCIES = 4;

static UiScreen currentScreen = UiScreen::STATUS_TELEMETRY;
static uint8_t selectedCatIdx = 0;   // Default: Trapped Persons
static uint8_t selectedUrgIdx = 3;   // Default: CRITICAL (index 3)
static uint32_t lastMenuActionMs = 0;

// Forward declaration
static void sendIncidentReport(const char *text, uint8_t urgency, uint8_t category, uint8_t victims);

// ============================================================================
// Interrupt Handler
// ============================================================================
#if defined(ESP8266) || defined(ESP32)
  ICACHE_RAM_ATTR
#endif
static void onPacketReceived(void) {
    rxFlag = true;
}

// ============================================================================
// PMU (AXP192 / AXP2101) Initialization & Battery Reading
// ============================================================================
static void initPMU() {
    if (pmu2101.begin(Wire, AXP2101_SLAVE_ADDRESS, I2C_SDA, I2C_SCL)) {
        pmuType = PmuType::AXP2101;
        pmu2101.setALDO2Voltage(3300); // LoRa
        pmu2101.enableALDO2();
        pmu2101.setALDO3Voltage(3300); // GPS
        pmu2101.enableALDO3();
        pmu2101.setDC1Voltage(3300);   // ESP32 + OLED
        pmu2101.enableDC1();
        pmu2101.enableBattDetection();
        pmu2101.enableBattVoltageMeasure();
        Serial.println(F("[PMU] AXP2101 initialized"));
        return;
    }

    if (pmu192.begin(Wire, AXP192_SLAVE_ADDRESS, I2C_SDA, I2C_SCL)) {
        pmuType = PmuType::AXP192;
        pmu192.setLDO2Voltage(3300);   // LoRa
        pmu192.enableLDO2();
        pmu192.setLDO3Voltage(3300);   // GPS
        pmu192.enableLDO3();
        pmu192.setDC1Voltage(3300);  // OLED
        pmu192.enableDC1();
        pmu192.enableBattVoltageMeasure();
        Serial.println(F("[PMU] AXP192 initialized"));
        return;
    }

    Serial.println(F("[PMU] No AXP192/AXP2101 detected"));
}

static void readBattery(uint16_t &mvOut, uint8_t &pctOut) {
    if (pmuType == PmuType::AXP2101) {
        mvOut = pmu2101.getBattVoltage();
        int pct = pmu2101.getBatteryPercent();
        pctOut = (pct >= 0 && pct <= 100) ? (uint8_t)pct : 100;
        return;
    }
    if (pmuType == PmuType::AXP192) {
        mvOut = pmu192.getBattVoltage();
        // Estimate Li-ion % from 3.2V - 4.2V range
        float pct = ((float)mvOut - 3200.0f) / 10.0f;
        if (pct < 0.0f) pct = 0.0f;
        if (pct > 100.0f) pct = 100.0f;
        pctOut = (uint8_t)pct;
        return;
    }
    mvOut = 4000;
    pctOut = 100;
}

// ============================================================================
// OLED Status & 4-Button Menu Display
// ============================================================================
static void updateDisplay(const char *banner = nullptr) {
    if (!oledReady) return;

    display.clearDisplay();
    display.setTextColor(SH110X_WHITE);
    display.setTextSize(1);

    if (currentScreen == UiScreen::STATUS_TELEMETRY) {
        uint16_t mv = 0;
        uint8_t pct = 0;
        readBattery(mv, pct);

        // Header
        display.setCursor(0, 0);
        display.printf("SALBAR %s | %u%%", SALBAR_NODE_ID, pct);
        display.drawLine(0, 10, 127, 10, SH110X_WHITE);

        // GPS & Radio Line
        display.setCursor(0, 14);
        if (gpsHasFix()) {
            display.printf("GPS:FIX(%lu) TX:%lu RX:%lu",
                           (unsigned long)gps.satellites.value(),
                           (unsigned long)txCount,
                           (unsigned long)rxCount);
        } else {
            display.printf("GPS:WAIT(%lu) TX:%lu RX:%lu",
                           (unsigned long)gps.satellites.value(),
                           (unsigned long)txCount,
                           (unsigned long)rxCount);
        }

        // Coordinates or Banner
        display.setCursor(0, 26);
        if (banner) {
            display.printf("EVT: %s", banner);
        } else if (gpsHasFix()) {
            display.printf("%.4f, %.4f", kalmanGps.lat(), kalmanGps.lng());
        } else if (!gpsModuleStreaming()) {
            display.print(F("GPS: NO DATA (CHECK)"));
        } else if (gpsHasLastKnown()) {
            display.printf("NO FIX, LAST %lus AGO", (unsigned long)gpsPositionAgeS());
        } else {
            display.printf("GPS: ACQUIRING %lus", (unsigned long)(millis() / 1000));
        }

        // Active Dispatch Section
        display.drawLine(0, 37, 127, 37, SH110X_WHITE);
        display.setCursor(0, 41);
        if (activeDispatchInc > 0) {
            display.printf("CMD INC-%03u:", activeDispatchInc);
            display.setCursor(0, 52);
            display.print(activeDispatchNote);
        } else {
            display.print(F("STANDBY - NO ORDERS"));
            display.drawLine(0, 50, 127, 50, SH110X_WHITE);
            display.setCursor(0, 54);
            display.print(F("[1/2:REPORT MENU]"));
        }

    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        display.setCursor(0, 0);
        display.print(F("TRIAGE CATEGORY (1/3)"));
        display.drawLine(0, 10, 127, 10, SH110X_WHITE);

        int prevIdx = (selectedCatIdx + NUM_CATEGORIES - 1) % NUM_CATEGORIES;
        int nextIdx = (selectedCatIdx + 1) % NUM_CATEGORIES;

        display.setCursor(6, 14);
        display.printf("  %s", TRIAGE_CATEGORIES[prevIdx]);

        display.setCursor(0, 26);
        display.printf("> %s", TRIAGE_CATEGORIES[selectedCatIdx]);

        display.setCursor(6, 38);
        display.printf("  %s", TRIAGE_CATEGORIES[nextIdx]);

        display.drawLine(0, 50, 127, 50, SH110X_WHITE);
        display.setCursor(0, 54);
        display.print(F("[1:UP 2:DN 3:SEL 4:BK]"));

    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        display.setCursor(0, 0);
        display.print(F("SELECT URGENCY (2/3)"));
        display.drawLine(0, 10, 127, 10, SH110X_WHITE);

        display.setCursor(0, 14);
        display.printf("Type: %s", TRIAGE_CATEGORIES[selectedCatIdx]);

        display.setCursor(0, 27);
        display.print(F("Urgency Level:"));

        display.setCursor(12, 38);
        display.printf(">> %s <<", URGENCY_LEVELS[selectedUrgIdx]);

        display.drawLine(0, 50, 127, 50, SH110X_WHITE);
        display.setCursor(0, 54);
        display.print(F("[1:UP 2:DN 3:OK 4:BK]"));

    } else if (currentScreen == UiScreen::INCIDENT_CONFIRM) {
        display.setCursor(0, 0);
        display.print(F("TRANSMIT ALERT (3/3)"));
        display.drawLine(0, 10, 127, 10, SH110X_WHITE);

        display.setCursor(0, 14);
        display.printf("Cat: %s", TRIAGE_CATEGORIES[selectedCatIdx]);

        display.setCursor(0, 26);
        display.printf("Sev: %s (Victims: 1)", URGENCY_LEVELS[selectedUrgIdx]);

        display.setCursor(0, 38);
        if (gpsHasFix()) {
            display.printf("GPS: LIVE +/-%.0fm", gpsAccuracyMeters());
        } else if (gpsHasLastKnown()) {
            display.printf("GPS: LAST %lus AGO", (unsigned long)gpsPositionAgeS());
        } else {
            display.print(F("GPS: NONE (no pos)"));
        }

        display.drawLine(0, 50, 127, 50, SH110X_WHITE);
        display.setCursor(0, 54);
        display.print(F("3:SEND 4:BACK"));
    }

    display.display();
}

// ============================================================================
// Serial Monitor ASCII OLED Screen Simulation
// ============================================================================
#define CLR_RESET   "\033[0m"
#define CLR_CYAN    "\033[1;36m"
#define CLR_GREEN   "\033[1;32m"
#define CLR_YELLOW  "\033[1;33m"
#define CLR_RED     "\033[1;31m"
#define CLR_WHITE   "\033[1;37m"
#define CLR_GRAY    "\033[0;90m"
#define CLR_MAGENTA "\033[1;35m"

// Helper function to print an exactly 66-character wide bordered row with ANSI color coding
static void printBoxRow(const char *colorCode, const char *fmt, ...) {
    char buf[128];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);

    // Cyan border, colored text, cyan border
    Serial.print(F(CLR_CYAN "| " CLR_RESET));
    Serial.print(colorCode);
    Serial.printf("%-62.62s", buf);
    Serial.print(F(CLR_RESET CLR_CYAN " |" CLR_RESET "\n"));
}

static void printSerialOledSimulation(const char *lastEvent = nullptr) {
    uint16_t mv = 0;
    uint8_t pct = 0;
    readBattery(mv, pct);

    bool fix = gpsHasFix();
    double lat = fix ? kalmanGps.lat() : 0.0;
    double lng = fix ? kalmanGps.lng() : 0.0;

    // Clear terminal screen and position cursor at top-left (VT100 / ANSI)
    Serial.print(F("\033[2J\033[H"));

    Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
    printBoxRow(CLR_WHITE, "SALBAR HANDHELD TERMINAL (SAR-01) | BATT: %u%% (%umV)", pct, mv);
    printBoxRow(CLR_CYAN, "LORA: 915.0 MHz SF9 CR4/7         | GPS: %s",
                fix ? "FIX (LIVE GPS)" : (gpsModuleStreaming() ? "ACQUIRING" : "NO DATA"));
    Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
    printBoxRow(CLR_YELLOW, "LIVE TELEMETRY (FIXED ON TERMINAL):");
    if (fix) {
        printBoxRow(CLR_WHITE, "  SEQ: #%-5u | LAT: %10.6f | LNG: %10.6f", txSeqNum, lat, lng);
        printBoxRow(CLR_GREEN, "  GPS: FIX | SATS: %u/%u | ACC: +/-%.1f m | AGE: %lu ms",
                    gpsSatellites(), gpsSatsInView(), gpsAccuracyMeters(),
                    (unsigned long)gps.location.age());
    } else if (gpsModuleStreaming()) {
        printBoxRow(CLR_WHITE, "  SEQ: #%-5u | LAT/LNG: -- NO FIX (sending 0,0)", txSeqNum);
        char inViewBuf[8];
        if (gpsHasGsv()) snprintf(inViewBuf, sizeof(inViewBuf), "%u", gpsSatsInView());
        else snprintf(inViewBuf, sizeof(inViewBuf), "n/a");
        uint8_t trk, strg, mx;
        gsvTotals(trk, strg, mx);
        printBoxRow(CLR_YELLOW, "  GPS: ACQUIRING | IN VIEW: %-3s | UP: %lus | NMEA: %lu B",
                    inViewBuf, (unsigned long)(millis() / 1000),
                    (unsigned long)gps.charsProcessed());
        printBoxRow(CLR_YELLOW, "  SIGNAL: TRACKED %u | STRONG %u | BEST %u dB | CKSUM ERR %lu",
                    trk, strg, mx, (unsigned long)gps.failedChecksum());
        if (ubxSvinfoFresh()) {
            printBoxRow(CLR_YELLOW, "  UBX: EPHEMERIS %u | LOCKED %u | USED %u | CH %u",
                        ubxEph, ubxLocked, ubxUsed, ubxNumCh);
        } else {
            printBoxRow(CLR_RED, "  UBX: NO NAV-SVINFO REPLY (frames ok: %lu)", (unsigned long)ubxFramesOk);
        }
    } else {
        printBoxRow(CLR_WHITE, "  SEQ: #%-5u | LAT/LNG: -- NO FIX (sending 0,0)", txSeqNum);
        printBoxRow(CLR_RED, "  GPS: NO DATA FROM MODULE - check GPS power / UART");
    }
    printBoxRow(currentStatus == SALBAR_STATUS_AVAILABLE ? CLR_GREEN : CLR_YELLOW,
                "  STATUS: %-9s | TX: %-4lu pkts | RX: %-4lu pkts",
                currentStatus == SALBAR_STATUS_AVAILABLE ? "AVAILABLE" :
                currentStatus == SALBAR_STATUS_EN_ROUTE   ? "EN_ROUTE" : "BUSY",
                (unsigned long)txCount, (unsigned long)rxCount);
    printBoxRow(CLR_WHITE, "  ORDERS: %s", activeDispatchNote);
    if (lastEvent) {
        printBoxRow(CLR_MAGENTA, "  EVENT : %s", lastEvent);
    }
    Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));

    if (currentScreen == UiScreen::STATUS_TELEMETRY) {
        printBoxRow(CLR_GREEN, "[OLED DISPLAY: STANDBY TELEMETRY MODE]");
        printBoxRow(CLR_WHITE, "");
        printBoxRow(CLR_WHITE, "Handheld is broadcasting periodic telemetry to Command Center.");
        printBoxRow(CLR_YELLOW, "Press [1] or [2] to open Field Triage Incident Menu.");
        printBoxRow(CLR_WHITE, "");
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
        printBoxRow(CLR_CYAN, "CONTROLS: [1] TRIAGE MENU  [T] SEND TELEMETRY  [I] BENCH SOS");
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        printBoxRow(CLR_YELLOW, "[OLED DISPLAY: FIELD TRIAGE - STEP 1/3: CATEGORY]");
        for (uint8_t i = 0; i < NUM_CATEGORIES; i++) {
            if (i == selectedCatIdx) {
                printBoxRow(CLR_GREEN, "--> [%u] %s", i + 1, TRIAGE_CATEGORIES[i]);
            } else {
                printBoxRow(CLR_GRAY, "    [%u] %s", i + 1, TRIAGE_CATEGORIES[i]);
            }
        }
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
        printBoxRow(CLR_CYAN, "CONTROLS: [1] UP  [2] DOWN  [3] SELECT  [4] BACK (EXIT MENU)");
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        printBoxRow(CLR_YELLOW, "[OLED DISPLAY: FIELD TRIAGE - STEP 2/3: URGENCY LEVEL]");
        printBoxRow(CLR_WHITE, "Category: %s", TRIAGE_CATEGORIES[selectedCatIdx]);
        printBoxRow(CLR_WHITE, "");
        for (uint8_t i = 0; i < NUM_URGENCIES; i++) {
            if (i == selectedUrgIdx) {
                printBoxRow(CLR_RED, "--> [%u] %s", i + 1, URGENCY_LEVELS[i]);
            } else {
                printBoxRow(CLR_GRAY, "    [%u] %s", i + 1, URGENCY_LEVELS[i]);
            }
        }
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
        printBoxRow(CLR_CYAN, "CONTROLS: [1] UP  [2] DOWN  [3] CONFIRM  [4] BACK");
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
    } else if (currentScreen == UiScreen::INCIDENT_CONFIRM) {
        printBoxRow(CLR_RED, "[OLED DISPLAY: FIELD TRIAGE - STEP 3/3: TRANSMIT INCIDENT]");
        printBoxRow(CLR_WHITE, "CATEGORY : %s", TRIAGE_CATEGORIES[selectedCatIdx]);
        printBoxRow(CLR_RED, "URGENCY  : %s", URGENCY_LEVELS[selectedUrgIdx]);
        if (fix) {
            printBoxRow(CLR_WHITE, "COORDS   : %.6f, %.6f (+/-%.1f m)", lat, lng, gpsAccuracyMeters());
        } else {
            printBoxRow(CLR_RED, "COORDS   : NO GPS FIX - report sent without location");
        }
        printBoxRow(CLR_CYAN, "TARGET   : GATEWAY / COMMAND CENTER (LORA 915 MHz)");
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
        printBoxRow(CLR_YELLOW, "CONTROLS: [3] BROADCAST OVER LORA NOW  [4] BACK");
        Serial.println(F(CLR_CYAN "+----------------------------------------------------------------+" CLR_RESET));
    }
}

// ============================================================================
// LoRa Packet Builders & Transmitters
// ============================================================================
static void fillHeader(SalbarHeader *hdr, uint8_t msgType) {
    memset(hdr, 0, sizeof(SalbarHeader));
    hdr->magic = SALBAR_PROTOCOL_MAGIC;
    hdr->version = SALBAR_PROTOCOL_VERSION;
    hdr->msg_type = msgType;
    hdr->seq_num = ++txSeqNum;
    strncpy(hdr->src_node, SALBAR_NODE_ID, sizeof(hdr->src_node));
    strncpy(hdr->dest_node, SALBAR_GATEWAY_ID, sizeof(hdr->dest_node));
}

static bool transmitPacket(uint8_t *buf, size_t payloadLen) {
    if (!radioReady) return false;

    uint16_t crc = salbar_crc16(buf, payloadLen);
    buf[payloadLen] = (uint8_t)(crc & 0xFF);
    buf[payloadLen + 1] = (uint8_t)((crc >> 8) & 0xFF);

    digitalWrite(BOARD_LED, LOW); // LED ON (active low)
    int state = radio.transmit(buf, payloadLen + 2);
    digitalWrite(BOARD_LED, HIGH);

    radio.startReceive();

    if (state == RADIOLIB_ERR_NONE) {
        txCount++;
        return true;
    }

    Serial.printf("[LoRa] TX failed, code=%d\n", state);
    return false;
}

static void sendTelemetry() {
    uint8_t txBuf[sizeof(SalbarHeader) + sizeof(SalbarTelemetryPayload) + 2];
    SalbarHeader *hdr = (SalbarHeader *)txBuf;
    fillHeader(hdr, SALBAR_MSG_TELEMETRY);

    SalbarTelemetryPayload *telem = (SalbarTelemetryPayload *)(txBuf + sizeof(SalbarHeader));
    memset(telem, 0, sizeof(SalbarTelemetryPayload));

    bool fix = gpsHasFix();
    double lat = fix ? kalmanGps.lat() : 0.0;
    double lng = fix ? kalmanGps.lng() : 0.0;
    uint16_t mv = 0;
    uint8_t pct = 0;
    readBattery(mv, pct);

    telem->lat_e7 = (int32_t)(lat * 10000000.0);
    telem->lng_e7 = (int32_t)(lng * 10000000.0);
    telem->accuracy_cm = fix ? kalmanGps.accuracyCm() : 0;
    telem->battery_mv = mv;
    telem->battery_pct = pct;
    telem->status = currentStatus;
    telem->fatigue_score = 15;
    telem->relayed_count = 0;
    telem->flags = (fix ? TELEM_FLAG_GPS_FIX : 0) |
                   (gpsModuleStreaming() ? TELEM_FLAG_GPS_DATA : 0) |
                   (uint8_t)(gpsSatellites() << 2);
    telem->sats_in_view = gpsSatsInView();
    telem->gps_receiver = gpsReceiverStatus();
    if (ubxSvinfoFresh()) {
        telem->ubx_eph = ubxEph;
        telem->ubx_locked = ubxLocked;
        telem->ubx_used = ubxUsed;
    } else {
        telem->ubx_eph = 0xFF;
        telem->ubx_locked = 0xFF;
        telem->ubx_used = 0xFF;
    }
    gsvTotals(telem->sats_tracked, telem->sats_strong, telem->max_snr);

    if (transmitPacket(txBuf, sizeof(SalbarHeader) + sizeof(SalbarTelemetryPayload))) {
        // Periodic background telemetry transmits silently over LoRa without refreshing the serial terminal
        updateDisplay("TX TELEMETRY");
    }
}

// Current UTC time from GPS as ms since midnight, or SALBAR_NO_TIME.
// NMEA time marks the fix epoch; age() adds the time since that sentence was parsed.
// The sentence arrives ~0.1-0.3 s after the epoch, so this reads slightly early.
static uint32_t gpsUtcMsOfDay() {
    if (!gps.time.isValid() || gps.time.age() > 5000) return SALBAR_NO_TIME;
    uint32_t ms = ((uint32_t)gps.time.hour() * 3600UL +
                   (uint32_t)gps.time.minute() * 60UL +
                   (uint32_t)gps.time.second()) * 1000UL +
                  (uint32_t)gps.time.centisecond() * 10UL +
                  gps.time.age();
    return ms % 86400000UL;
}

static void sendIncidentReport(const char *text, uint8_t urgency, uint8_t category, uint8_t victims) {
    uint32_t sentUtcMs = gpsUtcMsOfDay(); // stamp first: closest to the Send press
    uint8_t txBuf[sizeof(SalbarHeader) + sizeof(SalbarIncidentPayload) + 2];
    SalbarHeader *hdr = (SalbarHeader *)txBuf;
    fillHeader(hdr, SALBAR_MSG_INCIDENT);

    SalbarIncidentPayload *inc = (SalbarIncidentPayload *)(txBuf + sizeof(SalbarHeader));
    memset(inc, 0, sizeof(SalbarIncidentPayload));

    // Live fix: pos_age_s = 0. Fix lost: send the last-known position with its age,
    // so the dashboard labels it as old. Never had a fix: lat/lng 0 + SALBAR_POS_NONE.
    bool fix = gpsHasFix();
    bool lastKnown = !fix && gpsHasLastKnown();
    double lat = (fix || lastKnown) ? kalmanGps.lat() : 0.0;
    double lng = (fix || lastKnown) ? kalmanGps.lng() : 0.0;
    uint32_t ageS = gpsPositionAgeS();
    inc->pos_age_s = fix ? 0
                   : lastKnown ? (uint16_t)(ageS < 1 ? 1 : (ageS > 65534 ? 65534 : ageS))
                   : SALBAR_POS_NONE;

    inc->incident_id_num = nextIncidentNum++;
    inc->urgency = urgency;
    inc->category = category;
    inc->source = SALBAR_SRC_LORA_DIRECT;
    inc->victim_count = victims;
    inc->lat_e7 = (int32_t)(lat * 10000000.0);
    inc->lng_e7 = (int32_t)(lng * 10000000.0);
    inc->sent_utc_ms = sentUtcMs;

    size_t len = strlen(text);
    if (len > sizeof(inc->raw_text)) len = sizeof(inc->raw_text);
    inc->text_len = (uint8_t)len;
    memcpy(inc->raw_text, text, len);

    if (transmitPacket(txBuf, sizeof(SalbarHeader) + sizeof(SalbarIncidentPayload))) {
        char evtBuf[64];
        snprintf(evtBuf, sizeof(evtBuf), "INCIDENT #%u BROADCASTED OVER LORA", inc->incident_id_num);
        updateDisplay("TX INCIDENT!");
        printSerialOledSimulation(evtBuf);
    }
}

// ============================================================================
// LoRa Downlink Handler
// ============================================================================
static void processReceivedPacket() {
    uint8_t rxBuf[256];
    size_t len = radio.getPacketLength();
    if (len == 0 || len > sizeof(rxBuf)) {
        radio.startReceive();
        return;
    }

    if (radio.readData(rxBuf, len) != RADIOLIB_ERR_NONE) {
        radio.startReceive();
        return;
    }

    if (len < sizeof(SalbarHeader) + 2) {
        radio.startReceive();
        return;
    }

    const SalbarHeader *hdr = (const SalbarHeader *)rxBuf;
    if (hdr->magic != SALBAR_PROTOCOL_MAGIC) {
        radio.startReceive();
        return;
    }

    uint16_t rxCrc = rxBuf[len - 2] | (rxBuf[len - 1] << 8);
    uint16_t calcCrc = salbar_crc16(rxBuf, len - 2);
    if (rxCrc != calcCrc) {
        radio.startReceive();
        return;
    }

    rxCount++;

    if (hdr->msg_type == SALBAR_MSG_DISPATCH &&
        len >= sizeof(SalbarHeader) + sizeof(SalbarDispatchPayload) + 2) {
        const SalbarDispatchPayload *cmd =
            (const SalbarDispatchPayload *)(rxBuf + sizeof(SalbarHeader));

        // Accept if addressed to this node
        if (strncmp(cmd->target_node, SALBAR_NODE_ID, 6) == 0) {
            activeDispatchInc = cmd->incident_id_num;
            strncpy(activeDispatchNote, cmd->brief_notes, 32);
            activeDispatchNote[32] = '\0';
            if (cmd->command_code == 0) {
                currentStatus = SALBAR_STATUS_EN_ROUTE;
            } else if (cmd->command_code == 1) {
                currentStatus = SALBAR_STATUS_AVAILABLE;
            }

            char evtBuf[64];
            snprintf(evtBuf, sizeof(evtBuf), "RX DISPATCH: INC-%03u", cmd->incident_id_num);
            updateDisplay("RX DISPATCH!");
            printSerialOledSimulation(evtBuf);
        }
    }

    radio.startReceive();
}

// ============================================================================
// 4-Button Field Triage Handlers
// ============================================================================
static void handleNavSend();

static void handleNavUp() {
    lastMenuActionMs = millis();
    if (currentScreen == UiScreen::STATUS_TELEMETRY) {
        currentScreen = UiScreen::TRIAGE_CATEGORY;
    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        selectedCatIdx = (selectedCatIdx + NUM_CATEGORIES - 1) % NUM_CATEGORIES;
    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        selectedUrgIdx = (selectedUrgIdx + NUM_URGENCIES - 1) % NUM_URGENCIES;
    }
    updateDisplay();
    printSerialOledSimulation("BUTTON 1 (UP) PRESSED");
}

static void handleNavDown() {
    lastMenuActionMs = millis();
    if (currentScreen == UiScreen::STATUS_TELEMETRY) {
        currentScreen = UiScreen::TRIAGE_CATEGORY;
    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        selectedCatIdx = (selectedCatIdx + 1) % NUM_CATEGORIES;
    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        selectedUrgIdx = (selectedUrgIdx + 1) % NUM_URGENCIES;
    }
    updateDisplay();
    printSerialOledSimulation("BUTTON 2 (DOWN) PRESSED");
}

static void handleNavSelect() {
    lastMenuActionMs = millis();
    if (currentScreen == UiScreen::STATUS_TELEMETRY) {
        currentScreen = UiScreen::TRIAGE_CATEGORY;
    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        currentScreen = UiScreen::TRIAGE_URGENCY;
    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        currentScreen = UiScreen::INCIDENT_CONFIRM;
    } else if (currentScreen == UiScreen::INCIDENT_CONFIRM) {
        handleNavSend();
        return;
    }
    updateDisplay();
    printSerialOledSimulation("BUTTON 3 (SELECT) PRESSED");
}

// Button 4: step back one menu level (confirm -> urgency -> category -> standby)
static void handleNavBack() {
    lastMenuActionMs = millis();
    if (currentScreen == UiScreen::INCIDENT_CONFIRM) {
        currentScreen = UiScreen::TRIAGE_URGENCY;
    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        currentScreen = UiScreen::TRIAGE_CATEGORY;
    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        currentScreen = UiScreen::STATUS_TELEMETRY;
    }
    updateDisplay();
    printSerialOledSimulation("BUTTON 4 (BACK) PRESSED");
}

static void handleNavSend() {
    lastMenuActionMs = millis();
    char reportMsg[96];
    snprintf(reportMsg, sizeof(reportMsg), "Field triage report: %s [%s]%s",
             TRIAGE_CATEGORIES[selectedCatIdx], URGENCY_LEVELS[selectedUrgIdx],
             gpsHasFix() ? " at GPS fix." : " (no GPS fix).");

    sendIncidentReport(reportMsg, selectedUrgIdx, selectedCatIdx, 1);
    currentScreen = UiScreen::STATUS_TELEMETRY;
    updateDisplay("INCIDENT SENT!");
    printSerialOledSimulation("BUTTON 3 (SEND) - INCIDENT TRANSMITTED!");
}

// ============================================================================
// Setup & Main Loop
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(200);

    // Button Matrix & Status LED (Internal Pull-Ups active LOW)
    pinMode(USER_BTN, INPUT_PULLUP);
    pinMode(BTN_NAV_UP, INPUT_PULLUP);
    pinMode(BTN_NAV_DOWN, INPUT_PULLUP);
    pinMode(BTN_NAV_SELECT, INPUT_PULLUP);
    pinMode(BTN_NAV_SEND, INPUT_PULLUP);

    pinMode(BOARD_LED, OUTPUT);
    digitalWrite(BOARD_LED, HIGH); // OFF

    Wire.begin(I2C_SDA, I2C_SCL);
    initPMU();

    // I2C scan: shows whether the OLED (0x3C/0x3D) and PMU (0x34) answer.
    bool oledAt3C = false, oledAt3D = false;
    Serial.print(F("[I2C] Scan:"));
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            Serial.printf(" 0x%02X", addr);
            if (addr == 0x3C) oledAt3C = true;
            if (addr == 0x3D) oledAt3D = true;
        }
    }
    Serial.println();

    uint8_t oledAddr = oledAt3D && !oledAt3C ? 0x3D : OLED_ADDR;
    if (!oledAt3C && !oledAt3D) {
        Serial.println(F("[OLED] Not found on I2C. Check VCC/GND/SDA(21)/SCK(22) wires."));
    } else if (display.begin(oledAddr, true)) {
        oledReady = true;
        display.setContrast(0x7F);
        Serial.printf("[OLED] SH1106 init OK at 0x%02X\n", oledAddr);
        updateDisplay("BOOTING...");
    } else {
        Serial.printf("[OLED] SH1106 begin() FAILED at 0x%02X (buffer alloc or I2C)\n", oledAddr);
    }

    // Large RX buffer: NMEA keeps arriving while a LoRa packet is being sent
    gpsSerial.setRxBufferSize(2048);
    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
    delay(100);
    gpsEnableGsv();

    SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
    int8_t txPower = SALBAR_LORA_TX_POWER_DBM > TBEAM_LORA_MAX_DBM
                         ? TBEAM_LORA_MAX_DBM
                         : SALBAR_LORA_TX_POWER_DBM;

    int state = radio.begin(
        SALBAR_LORA_FREQ_MHZ,
        SALBAR_LORA_BW_KHZ,
        SALBAR_LORA_SF,
        SALBAR_LORA_CR,
        SALBAR_LORA_SYNC_WORD,
        txPower,
        SALBAR_LORA_PREAMBLE_LEN
    );

    if (state == RADIOLIB_ERR_NONE) {
        radioReady = true;
        radio.setPacketReceivedAction(onPacketReceived);
        radio.startReceive();
        Serial.println(F("[LoRa] SX1276 online @ 915.0 MHz SF9"));
        updateDisplay("LORA ONLINE");
    } else {
        Serial.printf("[LoRa] SX1276 init failed, code=%d\n", state);
        updateDisplay("LORA ERR!");
    }

    printSerialOledSimulation("BOOT COMPLETE - READY");
}

void loop() {
    // 1. Feed NEO-6M NMEA stream into TinyGPSPlus & Kalman filter
    while (gpsSerial.available() > 0) {
        char gpsChar = (char)gpsSerial.read();
        gsvFeed(gpsChar);
        ubxFeed((uint8_t)gpsChar);
        if (gps.encode(gpsChar) && gps.location.isUpdated() && gps.location.isValid()) {
            float hdop = gps.hdop.isValid() ? (float)gps.hdop.hdop() : 2.0f;
            gpsFeedMeasurement(gps.location.lat(), gps.location.lng(), hdop);
        }
    }
    // Poll u-blox NAV-SVINFO for ephemeris / lock diagnostics
    if (millis() - ubxLastPollMs >= UBX_POLL_MS) {
        ubxLastPollMs = millis();
        gpsSendUbx(0x01, 0x30, nullptr, 0);
    }

    // Retry enabling GSV (module may still be booting) until it appears, max 5 tries
    if (!gpsHasGsv() && gsvEnableAttempts < 5 && millis() - gsvLastAttemptMs > 3000) {
        gpsEnableGsv();
    }
    if (gps.charsProcessed() != gpsLastCharCount) {
        gpsLastCharCount = gps.charsProcessed();
        gpsLastCharMs = millis();
    }

    // Redraw serial screen when GPS state changes (fix acquired/lost, module silent)
    {
        bool fixNow = gpsHasFix();
        bool dataNow = gpsModuleStreaming();
        if (fixNow != gpsLastFixState || dataNow != gpsLastDataState) {
            const char *evt = fixNow ? "GPS FIX ACQUIRED"
                            : (dataNow ? (gpsLastFixState ? "GPS FIX LOST - ACQUIRING"
                                                          : "GPS MODULE DATA OK - ACQUIRING")
                                       : "GPS MODULE SILENT");
            gpsLastFixState = fixNow;
            gpsLastDataState = dataNow;
            updateDisplay();
            printSerialOledSimulation(evt);
        }
    }

    // OLED watchdog: loose breadboard jumpers can drop the screen's power or I2C.
    // When it powers back up it is blank and needs a fresh init, so probe every 2 s.
    {
        static uint32_t lastOledCheckMs = 0;
        if (millis() - lastOledCheckMs > 2000) {
            lastOledCheckMs = millis();
            Wire.beginTransmission(OLED_ADDR);
            bool present = (Wire.endTransmission() == 0);
            if (!present && oledReady) {
                oledReady = false;
                Serial.println(F("[OLED] Lost on I2C (check VCC/GND/SDA 21/SCK 22 jumpers)"));
            } else if (present && !oledReady) {
                if (display.begin(OLED_ADDR, true)) {
                    oledReady = true;
                    display.setContrast(0x7F);
                    Serial.println(F("[OLED] Reconnected, screen re-initialized"));
                    updateDisplay();
                }
            }
        }
    }

    // 2. Process incoming LoRa downlink packets
    if (rxFlag) {
        rxFlag = false;
        processReceivedPacket();
    }

    // 3. Auto-return to telemetry screen after 30 seconds of menu inactivity
    if (currentScreen != UiScreen::STATUS_TELEMETRY && (millis() - lastMenuActionMs > 30000)) {
        currentScreen = UiScreen::STATUS_TELEMETRY;
        updateDisplay();
        printSerialOledSimulation("STANDBY TIMEOUT");
    }

    // 4. Physical 4-Button Polling (Active LOW). One action per press: after a press,
    // every button must be released for 50 ms before the next press counts,
    // so holding a button no longer repeats it.
    uint32_t nowMs = millis();
    static bool btnArmed = true;
    static uint32_t btnReleasedSinceMs = 0;
    bool anyDown = digitalRead(BTN_NAV_UP) == LOW || digitalRead(BTN_NAV_DOWN) == LOW ||
                   digitalRead(BTN_NAV_SELECT) == LOW || digitalRead(BTN_NAV_SEND) == LOW ||
                   digitalRead(USER_BTN) == LOW;
    if (!btnArmed) {
        if (anyDown) {
            btnReleasedSinceMs = 0;
        } else if (btnReleasedSinceMs == 0) {
            btnReleasedSinceMs = nowMs;
        } else if (nowMs - btnReleasedSinceMs >= 50) {
            btnArmed = true;
        }
    }
    if (btnArmed && anyDown && nowMs - lastBtnPressMs > 150) {
        btnArmed = false;
        btnReleasedSinceMs = 0;
        if (digitalRead(BTN_NAV_UP) == LOW) {
            lastBtnPressMs = nowMs;
            handleNavUp();
        } else if (digitalRead(BTN_NAV_DOWN) == LOW) {
            lastBtnPressMs = nowMs;
            handleNavDown();
        } else if (digitalRead(BTN_NAV_SELECT) == LOW) {
            lastBtnPressMs = nowMs;
            handleNavSelect();
        } else if (digitalRead(BTN_NAV_SEND) == LOW) {
            lastBtnPressMs = nowMs;
            handleNavBack();
        } else if (digitalRead(USER_BTN) == LOW) {
            // Traditional single user button fallback
            lastBtnPressMs = nowMs;
            sendIncidentReport(
                "Field unit quick-alert: assistance needed at GPS coordinates.",
                SALBAR_URGENCY_HIGH,
                SALBAR_CAT_TRAPPED_PERSONS,
                1
            );
        }
    }

    // 5. USB Serial CLI for Bench Testing & Demonstration (Instant single-key response)
    while (Serial.available() > 0) {
        char ch = (char)Serial.read();
        if (ch == '1' || ch == 'u' || ch == 'U') {
            handleNavUp();
        } else if (ch == '2' || ch == 'd' || ch == 'D') {
            handleNavDown();
        } else if (ch == '3' || ch == 's' || ch == 'S' || ch == '\r' || ch == '\n') {
            handleNavSelect();
        } else if (ch == '4' || ch == 'b' || ch == 'B' || ch == 'x' || ch == 'X') {
            handleNavBack();
        } else if (ch >= '5' && ch <= '6' && currentScreen == UiScreen::TRIAGE_CATEGORY) {
            selectedCatIdx = (uint8_t)(ch - '1');
            printSerialOledSimulation("CATEGORY DIRECT SELECT");
        } else if (ch == 't' || ch == 'T') {
            sendTelemetry();
            printSerialOledSimulation("MANUAL TELEMETRY TRANSMITTED");
        } else if (ch == 'i' || ch == 'I') {
            sendIncidentReport(
                "Bench test incident from T-Beam SAR-01.",
                SALBAR_URGENCY_CRITICAL,
                SALBAR_CAT_TRAPPED_PERSONS,
                2
            );
        } else if (ch == 'r' || ch == 'R') {
            gpsFactoryReset();
            printSerialOledSimulation("GPS MODULE FACTORY RESET + RESTART");
        } else if (ch == 'h' || ch == 'H' || ch == '?') {
            printSerialOledSimulation("HELP REQUESTED");
        }
    }

    // 6. Periodic Telemetry Uplink
    if (millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryMs = millis();
        sendTelemetry();
    }

    // 7. Periodic OLED Refresh (Status screen refreshes every 2s)
    if (millis() - lastDisplayMs >= 2000) {
        lastDisplayMs = millis();
        if (currentScreen == UiScreen::STATUS_TELEMETRY) {
            updateDisplay();
        }
    }
}

