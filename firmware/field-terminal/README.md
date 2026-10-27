# Handheld Field Terminal Firmware (`firmware/field-terminal`)

## Target Hardware
- **Base Board**: LilyGO TTGO T-Beam V1.2 (ESP32-D0WDQ6, SX1262 / SX1276 LoRa 915 MHz, NEO-6M / NEO-M8N GNSS).
- **Peripherals**:
  - 0.96-inch (or 1.3-inch) I2C SSD1306 OLED display.
  - 4-tactile push-button input matrix (Navigate Up, Navigate Down, Select, Emergency Quick-Send).
  - 18650 3.7V rechargeable Li-ion battery with onboard AXP192 / AXP2101 power management.
  - 915 MHz 3–5 dBi SMA male whip antenna.

## Firmware Subsystems
1. **GPS Filtering & Smoothing Pipeline**:
   - Continuous NMEA sentence parsing.
   - Recursive linear **Kalman Filter** state-space estimation to filter multipath reflections and GPS coordinate scattering in obstructed terrains.
2. **Four-Button Triage Interface**:
   - Menu-driven structured report selection (Search & Rescue, Damage Assessment, Relief Need).
   - Display of incoming approved dispatch orders and team status.
3. **Bluetooth Low Energy (BLE) Peripheral**:
   - GATT service allowing nearby resident Android phones to connect and offload cached incident reports.
4. **LoRa Mesh Store-and-Forward**:
   - Multi-hop packet relaying for neighboring terminals.
   - Local flash queue storing undelivered packets until an intermediate relay or gateway link is acknowledged.
