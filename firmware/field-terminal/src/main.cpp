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
#include <RadioLib.h>
#include <TinyGPSPlus.h>
#include <XPowersLib.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "pins_config.h"
#include "kalman_gps.h"
#include "salbar_protocol.h"

// ============================================================================
// Peripherals & Radio Instances
// ============================================================================
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1

static Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
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

// Fallback coordinates (Cebu City) when indoors without GPS lock
static constexpr double FALLBACK_LAT = 10.3157;
static constexpr double FALLBACK_LNG = 123.8854;

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
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);

    if (currentScreen == UiScreen::STATUS_TELEMETRY) {
        uint16_t mv = 0;
        uint8_t pct = 0;
        readBattery(mv, pct);

        // Header
        display.setCursor(0, 0);
        display.printf("SALBAR %s | %u%%", SALBAR_NODE_ID, pct);
        display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

        // GPS & Radio Line
        display.setCursor(0, 14);
        if (gps.location.isValid()) {
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
        } else if (kalmanGps.isInitialized()) {
            display.printf("%.4f, %.4f", kalmanGps.lat(), kalmanGps.lng());
        } else {
            display.print(F("Loc: Fallback (No Fix)"));
        }

        // Active Dispatch Section
        display.drawLine(0, 37, 127, 37, SSD1306_WHITE);
        display.setCursor(0, 41);
        if (activeDispatchInc > 0) {
            display.printf("CMD INC-%03u:", activeDispatchInc);
        } else {
            display.print(F("DISPATCH:"));
        }
        display.setCursor(0, 52);
        display.print(activeDispatchNote);

    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        display.setCursor(0, 0);
        display.print(F("TRIAGE CATEGORY (1/3)"));
        display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

        int prevIdx = (selectedCatIdx + NUM_CATEGORIES - 1) % NUM_CATEGORIES;
        int nextIdx = (selectedCatIdx + 1) % NUM_CATEGORIES;

        display.setCursor(6, 14);
        display.printf("  %s", TRIAGE_CATEGORIES[prevIdx]);

        display.setCursor(0, 26);
        display.printf("> %s", TRIAGE_CATEGORIES[selectedCatIdx]);

        display.setCursor(6, 38);
        display.printf("  %s", TRIAGE_CATEGORIES[nextIdx]);

        display.drawLine(0, 50, 127, 50, SSD1306_WHITE);
        display.setCursor(0, 54);
        display.print(F("[1:UP 2:DN 3:SEL 4:TX]"));

    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        display.setCursor(0, 0);
        display.print(F("SELECT URGENCY (2/3)"));
        display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

        display.setCursor(0, 14);
        display.printf("Type: %s", TRIAGE_CATEGORIES[selectedCatIdx]);

        display.setCursor(0, 27);
        display.print(F("Urgency Level:"));

        display.setCursor(12, 38);
        display.printf(">> %s <<", URGENCY_LEVELS[selectedUrgIdx]);

        display.drawLine(0, 50, 127, 50, SSD1306_WHITE);
        display.setCursor(0, 54);
        display.print(F("[1:UP 2:DN 3:CONF 4:TX]"));

    } else if (currentScreen == UiScreen::INCIDENT_CONFIRM) {
        display.setCursor(0, 0);
        display.print(F("TRANSMIT ALERT (3/3)"));
        display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

        display.setCursor(0, 14);
        display.printf("Cat: %s", TRIAGE_CATEGORIES[selectedCatIdx]);

        display.setCursor(0, 26);
        display.printf("Sev: %s (Victims: 1)", URGENCY_LEVELS[selectedUrgIdx]);

        display.setCursor(0, 38);
        if (kalmanGps.isInitialized()) {
            display.printf("GPS: %.4f,%.4f", kalmanGps.lat(), kalmanGps.lng());
        } else {
            display.print(F("GPS: Fallback (Cebu)"));
        }

        display.drawLine(0, 50, 127, 50, SSD1306_WHITE);
        display.setCursor(0, 54);
        display.print(F("PRESS BTN 4 TO SEND"));
    }

    display.display();
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

    double lat = kalmanGps.isInitialized() ? kalmanGps.lat() : FALLBACK_LAT;
    double lng = kalmanGps.isInitialized() ? kalmanGps.lng() : FALLBACK_LNG;
    uint16_t mv = 0;
    uint8_t pct = 0;
    readBattery(mv, pct);

    telem->lat_e7 = (int32_t)(lat * 10000000.0);
    telem->lng_e7 = (int32_t)(lng * 10000000.0);
    telem->accuracy_cm = kalmanGps.isInitialized() ? kalmanGps.accuracyCm() : 5000;
    telem->battery_mv = mv;
    telem->battery_pct = pct;
    telem->status = currentStatus;
    telem->fatigue_score = 15;
    telem->relayed_count = 0;
    telem->flags = kalmanGps.isInitialized() ? 0x01 : 0x00;

    if (transmitPacket(txBuf, sizeof(SalbarHeader) + sizeof(SalbarTelemetryPayload))) {
        Serial.printf("[TX] TELEMETRY seq=%u lat=%.6f lng=%.6f batt=%umV(%u%%)\n",
                      hdr->seq_num, lat, lng, mv, pct);
        updateDisplay("TX TELEMETRY");
    }
}

static void sendIncidentReport(const char *text, uint8_t urgency, uint8_t category, uint8_t victims) {
    uint8_t txBuf[sizeof(SalbarHeader) + sizeof(SalbarIncidentPayload) + 2];
    SalbarHeader *hdr = (SalbarHeader *)txBuf;
    fillHeader(hdr, SALBAR_MSG_INCIDENT);

    SalbarIncidentPayload *inc = (SalbarIncidentPayload *)(txBuf + sizeof(SalbarHeader));
    memset(inc, 0, sizeof(SalbarIncidentPayload));

    double lat = kalmanGps.isInitialized() ? kalmanGps.lat() : FALLBACK_LAT;
    double lng = kalmanGps.isInitialized() ? kalmanGps.lng() : FALLBACK_LNG;

    inc->incident_id_num = nextIncidentNum++;
    inc->urgency = urgency;
    inc->category = category;
    inc->source = SALBAR_SRC_LORA_DIRECT;
    inc->victim_count = victims;
    inc->lat_e7 = (int32_t)(lat * 10000000.0);
    inc->lng_e7 = (int32_t)(lng * 10000000.0);

    size_t len = strlen(text);
    if (len > sizeof(inc->raw_text)) len = sizeof(inc->raw_text);
    inc->text_len = (uint8_t)len;
    memcpy(inc->raw_text, text, len);

    if (transmitPacket(txBuf, sizeof(SalbarHeader) + sizeof(SalbarIncidentPayload))) {
        Serial.printf("[TX] INCIDENT #%u seq=%u: %s\n", inc->incident_id_num, hdr->seq_num, text);
        updateDisplay("TX INCIDENT!");
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
        Serial.println(F("[LoRa] CRC mismatch on RX"));
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

            Serial.printf("[RX] DISPATCH inc=%u code=%u notes=\"%s\"\n",
                          cmd->incident_id_num, cmd->command_code, activeDispatchNote);
            updateDisplay("RX DISPATCH!");
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
    } else if (currentScreen == UiScreen::INCIDENT_CONFIRM) {
        currentScreen = UiScreen::TRIAGE_URGENCY;
    }
    Serial.printf("[UI-NAV] BTN 1 (UP) -> Screen=%d Category=\"%s\" Urgency=\"%s\"\n",
                  (int)currentScreen, TRIAGE_CATEGORIES[selectedCatIdx], URGENCY_LEVELS[selectedUrgIdx]);
    updateDisplay();
}

static void handleNavDown() {
    lastMenuActionMs = millis();
    if (currentScreen == UiScreen::STATUS_TELEMETRY) {
        currentScreen = UiScreen::TRIAGE_CATEGORY;
    } else if (currentScreen == UiScreen::TRIAGE_CATEGORY) {
        selectedCatIdx = (selectedCatIdx + 1) % NUM_CATEGORIES;
    } else if (currentScreen == UiScreen::TRIAGE_URGENCY) {
        selectedUrgIdx = (selectedUrgIdx + 1) % NUM_URGENCIES;
    } else if (currentScreen == UiScreen::INCIDENT_CONFIRM) {
        currentScreen = UiScreen::STATUS_TELEMETRY;
    }
    Serial.printf("[UI-NAV] BTN 2 (DOWN) -> Screen=%d Category=\"%s\" Urgency=\"%s\"\n",
                  (int)currentScreen, TRIAGE_CATEGORIES[selectedCatIdx], URGENCY_LEVELS[selectedUrgIdx]);
    updateDisplay();
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
    Serial.printf("[UI-NAV] BTN 3 (SELECT) -> Screen=%d Category=\"%s\" Urgency=\"%s\"\n",
                  (int)currentScreen, TRIAGE_CATEGORIES[selectedCatIdx], URGENCY_LEVELS[selectedUrgIdx]);
    updateDisplay();
}

static void handleNavSend() {
    lastMenuActionMs = millis();
    char reportMsg[96];
    snprintf(reportMsg, sizeof(reportMsg), "Field triage report: %s [%s] at GPS fix.",
             TRIAGE_CATEGORIES[selectedCatIdx], URGENCY_LEVELS[selectedUrgIdx]);

    Serial.printf("[UI-NAV] BTN 4 (SEND) -> Broadcasting LoRa INCIDENT! Cat=%u Urg=%u Msg=\"%s\"\n",
                  selectedCatIdx, selectedUrgIdx, reportMsg);

    sendIncidentReport(reportMsg, selectedUrgIdx, selectedCatIdx, 1);
    currentScreen = UiScreen::STATUS_TELEMETRY;
    updateDisplay("INCIDENT SENT!");
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

    if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        oledReady = true;
        updateDisplay("BOOTING...");
    }

    gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);

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

    Serial.println(F("\n=============================================="));
    Serial.println(F("SALBAR Field Terminal: 4-Button Firmware Online"));
    Serial.println(F("Navigation Controls (Physical or Serial CLI):"));
    Serial.println(F("  '1' or 'UP'     -> Button 1: Prev Category / Up"));
    Serial.println(F("  '2' or 'DOWN'   -> Button 2: Next Category / Down"));
    Serial.println(F("  '3' or 'SELECT' -> Button 3: Confirm / Urgency"));
    Serial.println(F("  '4' or 'SEND'   -> Button 4: Transmit Incident"));
    Serial.println(F("  'TELEMETRY'     -> Force Immediate Telemetry TX"));
    Serial.println(F("  'INCIDENT'      -> Instant Bench SOS Alert"));
    Serial.println(F("==============================================\n"));
}

void loop() {
    // 1. Feed NEO-6M NMEA stream into TinyGPSPlus & Kalman filter
    while (gpsSerial.available() > 0) {
        if (gps.encode(gpsSerial.read()) && gps.location.isUpdated() && gps.location.isValid()) {
            float accuracyM = gps.hdop.isValid() ? (float)(gps.hdop.hdop() * 2.5) : 5.0f;
            kalmanGps.update(gps.location.lat(), gps.location.lng(), accuracyM);
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
    }

    // 4. Physical 4-Button Polling (Active LOW, debounced 200ms)
    uint32_t nowMs = millis();
    if (nowMs - lastBtnPressMs > 200) {
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
            handleNavSend();
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
        } else if (ch == '3' || ch == 's' || ch == 'S') {
            handleNavSelect();
        } else if (ch == '4' || ch == 'x' || ch == 'X') {
            handleNavSend();
        } else if (ch == 't' || ch == 'T') {
            sendTelemetry();
        } else if (ch == 'i' || ch == 'I') {
            sendIncidentReport(
                "Bench test incident from T-Beam SAR-01.",
                SALBAR_URGENCY_CRITICAL,
                SALBAR_CAT_TRAPPED_PERSONS,
                2
            );
        } else if (ch == 'h' || ch == 'H' || ch == '?') {
            Serial.println(F("\n=== SALBAR Field Terminal CLI ==="));
            Serial.println(F("  Press '1' : Navigate Up / Prev Category"));
            Serial.println(F("  Press '2' : Navigate Down / Next Category"));
            Serial.println(F("  Press '3' : Select / Confirm Urgency"));
            Serial.println(F("  Press '4' : Transmit LoRa Incident Report"));
            Serial.println(F("  Press 'T' : Force Immediate Telemetry TX"));
            Serial.println(F("  Press 'I' : Send Immediate Bench SOS Alert"));
            Serial.println(F("=================================\n"));
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

