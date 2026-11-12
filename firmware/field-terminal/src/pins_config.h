#pragma once

// ============================================================================
// LilyGO TTGO T-Beam V1.1 / V1.2 Pin Configuration (ESP32 + SX1276 915MHz)
// ============================================================================

// Node Identity (must be <= 6 chars to fit SalbarHeader)
#define SALBAR_NODE_ID         "SAR-01"
#define SALBAR_GATEWAY_ID      "GATEWY"

// SPI Pins for Semtech SX1276 LoRa module
#define LORA_SCK               5
#define LORA_MISO              19
#define LORA_MOSI              27
#define LORA_NSS               18
#define LORA_RST               23
#define LORA_DIO0              26
#define LORA_DIO1              33

// NEO-6M GNSS UART Pins
#define GPS_RX                 34
#define GPS_TX                 12
#define GPS_BAUD               9600

// I2C Bus (AXP192/AXP2101 PMU + SSD1306 OLED)
#define I2C_SDA                21
#define I2C_SCL                22
#define OLED_ADDR              0x3C

// User Button & Onboard LED
#define USER_BTN               38   // Active LOW
#define BOARD_LED              4    // Active LOW on T-Beam V1.1/V1.2

// Telemetry & Power Limits
#define TELEMETRY_INTERVAL_MS  10000
#define TBEAM_LORA_MAX_DBM     20   // SX1276 max output power (+20 dBm)

