#pragma once

// ============================================================================
// LilyGO T3S3 SX1262 Pin Configuration (ESP32-S3)
// ============================================================================

// SPI Pins for Semtech SX1262 LoRa module
#define LORA_SCK       5
#define LORA_MISO      3
#define LORA_MOSI      6
#define LORA_NSS       7   // Chip Select
#define LORA_RST       8   // Reset
#define LORA_BUSY      34  // Busy indicator
#define LORA_DIO1      33  // Interrupt request (RX/TX done)

// Status LED
#define STATUS_LED     37

// Onboard I2C (if OLED is present)
#define I2C_SDA        18
#define I2C_SCL        17
