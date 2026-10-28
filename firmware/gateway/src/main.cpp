/**
 * SALBAR Base Station LoRa Gateway Firmware
 * Target Board: LilyGO T3S3 SX1262 915MHz (ESP32-S3)
 * 
 * Functions:
 * 1. Listens continuously for 915 MHz LoRa packets from field terminals.
 * 2. Unpacks bit-packed telemetry and incident reports into structured JSON.
 * 3. Streams formatted JSON packets to host computer over USB CDC Serial.
 * 4. Accepts downlink dispatch directives from host over Serial and broadcasts via LoRa.
 * 5. Provides built-in test/simulation loopback commands for testing before field hardware arrives.
 */

#include <Arduino.h>
#include <SPI.h>
#include <RadioLib.h>
#include <ArduinoJson.h>

#include "pins_config.h"
#include "salbar_protocol.h"

// Instantiate RadioLib SX1262 module with T3S3 pin mappings
static SX1262 radio = new Module(LORA_NSS, LORA_DIO1, LORA_RST, LORA_BUSY);

// Hardware SPI bus instance for ESP32-S3
static SPIClass spiBus(FSPI);

// Flag indicating a packet has been received via interrupt
static volatile bool packetReceivedFlag = false;

// Transmission lock flag
static volatile bool isTransmitting = false;

// Counter for diagnostics
static uint32_t totalPacketsReceived = 0;
static uint32_t totalPacketsTransmitted = 0;

// Interrupt Service Routine for LoRa RX Done
#if defined(ESP8266) || defined(ESP32)
  ICACHE_RAM_ATTR
#endif
void onPacketReceived(void) {
    packetReceivedFlag = true;
}

// Convert category enum to CAD JSON string
static const char* categoryToString(uint8_t cat) {
    switch (cat) {
        case SALBAR_CAT_TRAPPED_PERSONS:   return "trapped-persons";
        case SALBAR_CAT_MEDICAL_EMERGENCY: return "medical-emergency";
        case SALBAR_CAT_FLOOD_INUNDATION:  return "flood-inundation";
        case SALBAR_CAT_STRUCTURAL_DAMAGE: return "structural-collapse";
        case SALBAR_CAT_LANDSLIDE_HAZARD:  return "landslide-hazard";
        case SALBAR_CAT_RELIEF_SUPPLIES:   return "relief-supplies";
        default: return "other";
    }
}

// Convert urgency enum to CAD JSON string
static const char* urgencyToString(uint8_t urgency) {
    switch (urgency) {
        case SALBAR_URGENCY_CRITICAL: return "CRITICAL";
        case SALBAR_URGENCY_HIGH:     return "HIGH";
        case SALBAR_URGENCY_MODERATE: return "MODERATE";
        case SALBAR_URGENCY_LOW:      return "LOW";
        default: return "LOW";
    }
}

// Convert responder status to CAD JSON string
static const char* statusToString(uint8_t status) {
    switch (status) {
        case SALBAR_STATUS_AVAILABLE: return "AVAILABLE";
        case SALBAR_STATUS_EN_ROUTE:  return "EN_ROUTE";
        case SALBAR_STATUS_ON_SCENE:  return "ON_SCENE";
        case SALBAR_STATUS_RESTING:   return "RESTING";
        case SALBAR_STATUS_OFFLINE:   return "OFFLINE";
        default: return "AVAILABLE";
    }
}

// Convert source enum to CAD JSON string
static const char* sourceToString(uint8_t src) {
    switch (src) {
        case SALBAR_SRC_LORA_DIRECT:   return "LORA_DIRECT";
        case SALBAR_SRC_LORA_MESH_BLE: return "LORA_MESH_BLE";
        case SALBAR_SRC_CLOUD_RELAY:   return "CLOUD_RELAY";
        default: return "LORA_DIRECT";
    }
}

// Process and unpack a received radio packet
static void processReceivedPacket() {
    uint8_t rxBuffer[256];
    size_t packetLen = radio.getPacketLength();

    if (packetLen == 0 || packetLen > sizeof(rxBuffer)) {
        radio.startReceive();
        return;
    }

    int state = radio.readData(rxBuffer, packetLen);
    if (state != RADIOLIB_ERR_NONE) {
        // Read error
        radio.startReceive();
        return;
    }

    float rssi = radio.getRSSI();
    float snr = radio.getSNR();
    totalPacketsReceived++;

    // Blink status LED
    #ifdef STATUS_LED
    digitalWrite(STATUS_LED, HIGH);
    #endif

    // Minimum check: Header + 2 bytes CRC
    if (packetLen < sizeof(SalbarHeader) + 2) {
        // Unknown raw frame, forward as raw telemetry
        JsonDocument doc;
        doc["type"] = "RAW_FRAME";
        doc["rssi"] = rssi;
        doc["snr"] = snr;
        doc["len"] = packetLen;
        serializeJson(doc, Serial);
        Serial.println();
        radio.startReceive();
        return;
    }

    const SalbarHeader *header = (const SalbarHeader*)rxBuffer;
    if (header->magic != SALBAR_PROTOCOL_MAGIC) {
        // Not a SALBAR frame
        radio.startReceive();
        return;
    }

    // Verify CRC16
    uint16_t receivedCrc = rxBuffer[packetLen - 2] | (rxBuffer[packetLen - 1] << 8);
    uint16_t computedCrc = salbar_crc16(rxBuffer, packetLen - 2);

    if (receivedCrc != computedCrc) {
        JsonDocument doc;
        doc["type"] = "CRC_ERROR";
        doc["src"] = String(header->src_node, 6);
        doc["rssi"] = rssi;
        serializeJson(doc, Serial);
        Serial.println();
        radio.startReceive();
        return;
    }

    // Extract payloads based on message type
    if (header->msg_type == SALBAR_MSG_TELEMETRY) {
        if (packetLen >= sizeof(SalbarHeader) + sizeof(SalbarTelemetryPayload) + 2) {
            const SalbarTelemetryPayload *telem = (const SalbarTelemetryPayload*)(rxBuffer + sizeof(SalbarHeader));
            
            JsonDocument doc;
            doc["type"] = "TELEMETRY";
            doc["srcNode"] = String(header->src_node, 6);
            doc["destNode"] = String(header->dest_node, 6);
            doc["seq"] = header->seq_num;
            doc["rssi"] = rssi;
            doc["snr"] = snr;

            JsonObject data = doc["data"].to<JsonObject>();
            data["id"] = String(header->src_node, 6);
            data["lat"] = telem->lat_e7 / 10000000.0;
            data["lng"] = telem->lng_e7 / 10000000.0;
            data["accuracyMeters"] = telem->accuracy_cm / 100.0;
            data["kalmanFiltered"] = (telem->flags & 0x01) != 0;
            data["batteryVoltage"] = telem->battery_mv / 1000.0;
            data["batteryPercent"] = telem->battery_pct;
            data["status"] = statusToString(telem->status);
            data["fatigueScore"] = telem->fatigue_score;
            data["relayedReportsCount"] = telem->relayed_count;

            serializeJson(doc, Serial);
            Serial.println();
        }
    } else if (header->msg_type == SALBAR_MSG_INCIDENT) {
        if (packetLen >= sizeof(SalbarHeader) + sizeof(SalbarIncidentPayload) + 2) {
            const SalbarIncidentPayload *inc = (const SalbarIncidentPayload*)(rxBuffer + sizeof(SalbarHeader));

            char rawTextBuf[129];
            size_t textLen = inc->text_len < 128 ? inc->text_len : 128;
            memcpy(rawTextBuf, inc->raw_text, textLen);
            rawTextBuf[textLen] = '\0';

            char incIdBuf[32];
            snprintf(incIdBuf, sizeof(incIdBuf), "INC-2026-%03u", inc->incident_id_num);

            JsonDocument doc;
            doc["type"] = "INCIDENT";
            doc["srcNode"] = String(header->src_node, 6);
            doc["seq"] = header->seq_num;
            doc["rssi"] = rssi;
            doc["snr"] = snr;

            JsonObject data = doc["data"].to<JsonObject>();
            data["id"] = incIdBuf;
            data["urgency"] = urgencyToString(inc->urgency);
            data["category"] = categoryToString(inc->category);
            data["source"] = sourceToString(inc->source);
            data["victimCount"] = inc->victim_count;
            data["lat"] = inc->lat_e7 / 10000000.0;
            data["lng"] = inc->lng_e7 / 10000000.0;
            data["rawText"] = rawTextBuf;

            serializeJson(doc, Serial);
            Serial.println();
        }
    }

    #ifdef STATUS_LED
    digitalWrite(STATUS_LED, LOW);
    #endif

    // Resume listening for next transmission
    radio.startReceive();
}

// Transmit a downlink dispatch command over LoRa to a field terminal
static bool transmitDispatchDownlink(const char *targetNode, uint16_t incidentIdNum, uint8_t cmdCode, double lat, double lng, const char *notes) {
    uint8_t txBuffer[sizeof(SalbarHeader) + sizeof(SalbarDispatchPayload) + 2];
    
    SalbarHeader *header = (SalbarHeader*)txBuffer;
    header->magic = SALBAR_PROTOCOL_MAGIC;
    header->version = SALBAR_PROTOCOL_VERSION;
    header->msg_type = SALBAR_MSG_DISPATCH;
    header->seq_num = (uint16_t)(++totalPacketsTransmitted);
    strncpy(header->src_node, "GATEWY", sizeof(header->src_node));
    strncpy(header->dest_node, targetNode, sizeof(header->dest_node));

    SalbarDispatchPayload *dispatch = (SalbarDispatchPayload*)(txBuffer + sizeof(SalbarHeader));
    dispatch->incident_id_num = incidentIdNum;
    strncpy(dispatch->target_node, targetNode, sizeof(dispatch->target_node));
    dispatch->command_code = cmdCode;
    dispatch->dest_lat_e7 = (int32_t)(lat * 10000000.0);
    dispatch->dest_lng_e7 = (int32_t)(lng * 10000000.0);
    strncpy(dispatch->brief_notes, notes ? notes : "", sizeof(dispatch->brief_notes));

    // Append CRC16
    size_t payloadLen = sizeof(SalbarHeader) + sizeof(SalbarDispatchPayload);
    uint16_t crc = salbar_crc16(txBuffer, payloadLen);
    txBuffer[payloadLen] = (uint8_t)(crc & 0xFF);
    txBuffer[payloadLen + 1] = (uint8_t)((crc >> 8) & 0xFF);

    #ifdef STATUS_LED
    digitalWrite(STATUS_LED, HIGH);
    #endif

    int state = radio.transmit(txBuffer, sizeof(txBuffer));

    #ifdef STATUS_LED
    digitalWrite(STATUS_LED, LOW);
    #endif

    // Re-enter receive mode immediately after transmission
    radio.startReceive();

    return (state == RADIOLIB_ERR_NONE);
}

// Handle host serial commands
static void handleSerialCommand(const String &cmdLine) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, cmdLine);
    if (err) {
        JsonDocument errDoc;
        errDoc["status"] = "ERR_JSON_PARSE";
        errDoc["msg"] = err.c_str();
        serializeJson(errDoc, Serial);
        Serial.println();
        return;
    }

    const char *cmd = doc["cmd"] | "";

    if (strcmp(cmd, "PING") == 0) {
        JsonDocument res;
        res["status"] = "PONG";
        res["device"] = "LILYGO_T3S3_SX1262";
        res["band"] = "915MHz";
        res["rxCount"] = totalPacketsReceived;
        res["txCount"] = totalPacketsTransmitted;
        serializeJson(res, Serial);
        Serial.println();
    } else if (strcmp(cmd, "DISPATCH") == 0) {
        const char *target = doc["targetUnit"] | "SAR-01";
        uint16_t incId = doc["incidentIdNum"] | 1;
        uint8_t code = doc["actionCode"] | 0;
        double lat = doc["lat"] | 10.315;
        double lng = doc["lng"] | 123.885;
        const char *notes = doc["notes"] | "";

        bool ok = transmitDispatchDownlink(target, incId, code, lat, lng, notes);
        JsonDocument res;
        res["status"] = ok ? "DISPATCH_SENT" : "DISPATCH_FAILED";
        res["targetUnit"] = target;
        res["incidentIdNum"] = incId;
        serializeJson(res, Serial);
        Serial.println();
    } else if (strcmp(cmd, "SIMULATE_TELEMETRY") == 0) {
        // Built-in test: injects simulated telemetry packet over serial
        JsonDocument res;
        res["type"] = "TELEMETRY";
        res["srcNode"] = doc["nodeId"] | "SAR-01";
        res["rssi"] = -65.0;
        res["snr"] = 9.5;
        JsonObject data = res["data"].to<JsonObject>();
        data["id"] = doc["nodeId"] | "SAR-01";
        data["lat"] = doc["lat"] | 10.3142;
        data["lng"] = doc["lng"] | 123.8875;
        data["accuracyMeters"] = doc["accuracy"] | 2.4;
        data["kalmanFiltered"] = true;
        data["batteryVoltage"] = doc["voltage"] | 4.02;
        data["batteryPercent"] = doc["battery"] | 88;
        data["status"] = doc["status"] | "AVAILABLE";
        data["fatigueScore"] = doc["fatigue"] | 28;
        data["relayedReportsCount"] = doc["relayed"] | 6;
        serializeJson(res, Serial);
        Serial.println();
    } else if (strcmp(cmd, "SIMULATE_INCIDENT") == 0) {
        // Built-in test: injects simulated emergency report over serial
        JsonDocument res;
        res["type"] = "INCIDENT";
        res["srcNode"] = doc["srcNode"] | "SAR-01";
        res["rssi"] = -70.0;
        res["snr"] = 8.0;
        JsonObject data = res["data"].to<JsonObject>();
        data["id"] = doc["id"] | "INC-2026-099";
        data["urgency"] = doc["urgency"] | "CRITICAL";
        data["category"] = doc["category"] | "trapped-persons";
        data["source"] = doc["source"] | "LORA_MESH_BLE";
        data["lat"] = doc["lat"] | 10.3185;
        data["lng"] = doc["lng"] | 123.8835;
        data["victimCount"] = doc["victims"] | 2;
        data["rawText"] = doc["rawText"] | "Simulated emergency transmission via LoRa.";
        serializeJson(res, Serial);
        Serial.println();
    }
}

void setup() {
    // Initialize USB CDC Serial
    Serial.begin(115200);
    
    #ifdef STATUS_LED
    pinMode(STATUS_LED, OUTPUT);
    digitalWrite(STATUS_LED, LOW);
    #endif

    // Setup custom SPI bus for T3S3
    spiBus.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);

    // Give host serial connection a moment to enumerate
    delay(1500);

    // Initialize Semtech SX1262 LoRa module
    int state = radio.begin(
        SALBAR_LORA_FREQ_MHZ,
        SALBAR_LORA_BW_KHZ,
        SALBAR_LORA_SF,
        SALBAR_LORA_CR,
        SALBAR_LORA_SYNC_WORD,
        SALBAR_LORA_TX_POWER_DBM,
        SALBAR_LORA_PREAMBLE_LEN
    );

    if (state != RADIOLIB_ERR_NONE) {
        JsonDocument doc;
        doc["status"] = "INIT_FAILED";
        doc["error_code"] = state;
        doc["device"] = "LILYGO_T3S3_SX1262";
        serializeJson(doc, Serial);
        Serial.println();
        while (true) {
            #ifdef STATUS_LED
            digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
            #endif
            delay(250);
        }
    }

    // Attach DIO1 interrupt callback for asynchronous non-blocking packet reception
    radio.setPacketReceivedAction(onPacketReceived);

    // Begin listening for packets
    state = radio.startReceive();
    if (state != RADIOLIB_ERR_NONE) {
        JsonDocument doc;
        doc["status"] = "RX_START_FAILED";
        doc["error_code"] = state;
        serializeJson(doc, Serial);
        Serial.println();
    } else {
        JsonDocument doc;
        doc["status"] = "GATEWAY_ONLINE";
        doc["device"] = "LILYGO_T3S3_SX1262";
        doc["freqMHz"] = SALBAR_LORA_FREQ_MHZ;
        doc["sf"] = SALBAR_LORA_SF;
        doc["bwKHz"] = SALBAR_LORA_BW_KHZ;
        serializeJson(doc, Serial);
        Serial.println();
    }
}

void loop() {
    // 1. Process LoRa packets received via interrupt
    if (packetReceivedFlag) {
        packetReceivedFlag = false;
        processReceivedPacket();
    }

    // 2. Read incoming commands from host USB Serial
    if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) {
            handleSerialCommand(line);
        }
    }

    // Yield to FreeRTOS watchdog
    vTaskDelay(pdMS_TO_TICKS(5));
}
