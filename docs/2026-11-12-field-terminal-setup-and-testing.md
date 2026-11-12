# SALBAR Field Terminal: Setup, Architecture & Increment 1 Testing Guide

- **Date**: November 12, 2026 (`2026-11-12`)
- **Branch**: `feat/field-terminal-setup`
- **Status**: Compiled & Verified (`pio run`); Awaiting Physical Hardware Flash
- **Scope**: LILYGO TTGO T-Beam (ESP32 + SX1276 915 MHz + NEO-6M GNSS) Field Terminal Firmware & End-to-End Increment 1 Test Plan.

---

## 1. Executive Summary

This document records the setup of **`firmware/field-terminal`** for **Increment 1** — enabling a single handheld **LILYGO TTGO T-Beam (SX1276, 868/915 MHz, NEO-6M)** node (`SAR-01`) to transmit live GPS telemetry and emergency incident reports over 915 MHz LoRa to the **LILYGO T3S3 Gateway** (`GATEWY`), display them on the **Operator Web Dashboard**, and receive Human-in-the-Loop (HITL) dispatch orders back on the handheld OLED.

---

## 2. Hardware & RF Configuration

| Component | Specification |
| :--- | :--- |
| **Board** | LILYGO TTGO T-Beam V1.1 / V1.2 (ESP32) |
| **LoRa Transceiver** | Semtech SX1276 (915.0 MHz ISM Band, capped at `+20 dBm` max) |
| **GNSS Module** | u-blox NEO-6M (`9600 baud`, UART1 on RX `GPIO 34` / TX `GPIO 12`) |
| **Power Management** | Auto-detected `AXP192` (V1.1) or `AXP2101` (V1.2) via `XPowersLib` |
| **Display** | 0.96" / 1.3" I2C SSD1306 OLED (`0x3C` on SDA `21` / SCL `22`) |
| **Inputs / Indicators** | Onboard User Button (`GPIO 38`, active LOW), Onboard LED (`GPIO 4`, active LOW) |

> [!CAUTION]
> **Antenna Requirement**: Always attach the 915 MHz SMA antenna to the T-Beam **and** the T3S3 Gateway before powering either board via USB or battery.

### Over-the-Air Compatibility with T3S3 Gateway
Both `firmware/field-terminal` (SX1276) and `firmware/gateway` (SX1262) share [`firmware/shared/include/salbar_protocol.h`](file:///c:/SALBAR/firmware/shared/include/salbar_protocol.h):
- **Frequency**: `915.0 MHz`
- **Bandwidth**: `125.0 kHz`
- **Spreading Factor**: `SF9`
- **Coding Rate**: `4/7` (`CR = 7`)
- **Sync Word**: `0x12`
- **Preamble Length**: `8`
- **TX Power**: `20 dBm` on T-Beam SX1276 (clamped from `SALBAR_LORA_TX_POWER_DBM = 22` to stay within SX1276 hardware limits); `22 dBm` on T3S3 SX1262.

---

## 3. Files Created

1. **[`firmware/field-terminal/platformio.ini`](file:///c:/SALBAR/firmware/field-terminal/platformio.ini)**
   - Defines environment `[env:tbeam_sx1276]` (`board = ttgo-t-beam`, Arduino framework, `-I ../shared/include`).
   - Dependencies: `jgromes/RadioLib @ ^6.6.0`, `mikalhart/TinyGPSPlus @ ^1.1.0`, `lewisxhe/XPowersLib @ ^0.2.6`, `adafruit/Adafruit SSD1306 @ ^2.5.17`, `adafruit/Adafruit GFX Library @ ^1.11.9`.
2. **[`firmware/field-terminal/src/pins_config.h`](file:///c:/SALBAR/firmware/field-terminal/src/pins_config.h)**
   - Sets `SALBAR_NODE_ID = "SAR-01"`, `SALBAR_GATEWAY_ID = "GATEWY"`, SX1276 SPI pins (`SCK 5`, `MISO 19`, `MOSI 27`, `NSS 18`, `RST 23`, `DIO0 26`, `DIO1 33`), GPS UART (`34/12`), I2C (`21/22`), button (`38`), LED (`4`), `TELEMETRY_INTERVAL_MS = 10000`, and `TBEAM_LORA_MAX_DBM = 20`.
3. **[`firmware/field-terminal/src/kalman_gps.h`](file:///c:/SALBAR/firmware/field-terminal/src/kalman_gps.h)**
   - Implements `KalmanGPS`, a lightweight recursive linear Kalman filter that smooths NEO-6M `lat`/`lng` measurements using HDOP-derived measurement variance and computes `accuracyCm()`.
4. **[`firmware/field-terminal/src/main.cpp`](file:///c:/SALBAR/firmware/field-terminal/src/main.cpp)**
   - **PMU Auto-Detection**: Probes `AXP2101` then `AXP192`, enables power rails for LoRa, GPS, and OLED, and reads real battery `mV` and `%`.
   - **GNSS + Fallback**: Feeds `Serial1` NMEA sentences into `TinyGPSPlus` + `KalmanGPS`; uses Cebu City fallback coordinates (`10.3157, 123.8854`) if tested indoors without a GPS lock.
   - **Uplink Telemetry**: Sends `SALBAR_MSG_TELEMETRY` every 10 seconds with `SalbarHeader` + `SalbarTelemetryPayload` + CCITT `CRC16`.
   - **Quick-Alert Incident**: Pressing the onboard button (`GPIO 38`) or sending `INCIDENT` over USB Serial transmits `SALBAR_MSG_INCIDENT`.
   - **Downlink Dispatch**: Listens via `DIO0` interrupt for `SALBAR_MSG_DISPATCH` packets addressed to `SAR-01`, updates responder status (`EN_ROUTE` / `AVAILABLE`), and renders the dispatch note on the SSD1306 OLED.

---

## 4. Build Verification (No Hardware Needed)

Compile the firmware from the repo:
```powershell
& "C:\Users\Jonathan\.platformio\penv\Scripts\pio.exe" run -d c:\SALBAR\firmware\field-terminal
```
Verified output (`2026-11-12`):
- `[SUCCESS]` — RAM: `1.8%` (`23484 bytes`), Flash: `28.4%` (`371737 bytes`).

---

## 5. How to Test Increment 1 (When Hardware Is In Hand)

### Step 1: Flash Both Boards
1. **T3S3 Gateway** (if not already flashed):
   ```powershell
   & "C:\Users\Jonathan\.platformio\penv\Scripts\pio.exe" run -d c:\SALBAR --target upload
   ```
   *(Remember to tap `RST` or replug USB-C on the T3S3 after flashing on Windows.)*
2. **TTGO T-Beam Field Terminal**:
   Connect the T-Beam via USB (leave the T3S3 unplugged during upload or specify `--upload-port COMx`), then run:
   ```powershell
   & "C:\Users\Jonathan\.platformio\penv\Scripts\pio.exe" run -d c:\SALBAR\firmware\field-terminal --target upload
   ```
3. Optional: Open the T-Beam Serial Monitor (`115200 baud`) to confirm:
   - `[PMU] AXP192 initialized` (or `AXP2101 initialized`)
   - `[LoRa] SX1276 online @ 915.0 MHz SF9`
   - `[TX] TELEMETRY seq=...` every 10 seconds.

### Step 2: Start the Host Bridge & Web Dashboard
1. Ensure only the **T3S3 Gateway** is connected to the PC (or power the T-Beam from its 18650 battery / a separate USB charger so `bridge.py` auto-detects the T3S3 COM port).
2. Terminal 1 — Start Python Serial Bridge:
   ```powershell
   cd c:\SALBAR\services\serial-bridge
   python bridge.py
   ```
3. Terminal 2 — Start Web Dashboard:
   ```powershell
   cd c:\SALBAR\apps\web-dashboard
   npm run dev
   ```
4. Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Step 3: End-to-End Verification Checklist
1. **Uplink Telemetry**:
   - Within 10 seconds of T-Beam boot, `bridge.py` should log incoming `TELEMETRY` from `SAR-01` with live RSSI/SNR.
   - On the dashboard Tactical Map, the `SAR-01` marker updates with live battery voltage/`%` and coordinates (take the T-Beam near a window/outdoors for a real NEO-6M GPS fix; indoors it uses fallback coordinates).
2. **Uplink Incident**:
   - Press the T-Beam onboard button (`GPIO 38`) — or type `INCIDENT` in the T-Beam Serial Monitor.
   - The T-Beam OLED briefly shows `EVT: TX INCIDENT!`, and the incident appears in the dashboard's **Live CAD Incident Queue**.
3. **Downlink Dispatch (HITL)**:
   - On the dashboard, select the incident and click **[Authorize Dispatch]**.
   - The T3S3 Gateway transmits `SALBAR_MSG_DISPATCH` over 915 MHz LoRa.
   - The T-Beam OLED updates to display `CMD INC-xxx:` and the dispatch note (`brief_notes`).

