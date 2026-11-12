# SALBAR Gateway Base Station: Setup, Testing & Verification Guide

- **Date**: October 28, 2026 (`2026-10-28`)
- **System Version**: 1.0.0
- **Scope**: LILYGO T3S3 SX1262 (915 MHz), Python Serial-WebSocket Bridge, Operator Web Dashboard (CAD).
- **Target Audience**: Development Teammates & AI Coding Agents.

---

## 1. Executive Overview & Purpose

This guide outlines how human teammates and automated AI agents can set up, compile, flash, and test the **SALBAR Gateway Base Station** pipeline.

On **October 28, 2026**, the hardware-to-software pipeline was verified end-to-end:
1. Physical **ESP32-S3** microcontroller flashed with custom RadioLib gateway firmware.
2. Physical **Semtech SX1262** transceiver initialized on 915 MHz with TCXO and RF switch controls.
3. Host **Python Serial Bridge** communicating bidirectionally with `COM` port at 115200 baud.
4. **Operator CAD Web Dashboard** streaming real-time Leaflet map markers and dispatching over-the-air LoRa orders via Human-in-the-Loop (HITL) approval.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         VERIFIED END-TO-END DATA PIPELINE                        │
└──────────────────────────────────────────────────────────────────────────────────┘

 [ Physical LILYGO T3S3 SX1262 ]
         ▲
         │ SPI (SCK 5, MISO 3, MOSI 6, NSS 7) + DIO1 Interrupt (GPIO 33)
         ▼
 [ ESP32-S3 Gateway Firmware (firmware/gateway) ]
         ▲
         │ Native USB CDC (115200 baud, JSON Lines over COMx)
         ▼
 [ Python Host Bridge (services/serial-bridge/bridge.py) ]
         ▲
         │ Bidirectional WebSockets (ws://localhost:8080)
         ▼
 [ Operator Web Dashboard (apps/web-dashboard) ]
         - Tactical GIS Leaflet Map (Real-time SAR-01 marker tracking)
         - Live CAD Incident Queue (Real-time triage stream)
         - HITL Dispatch Drawer (Downlink command authorization)
```

---

## 2. Hardware Specifications

| Component | Specification |
| :--- | :--- |
| **Microcontroller** | ESP32-S3 (Xtensa Dual-Core LX7, 240MHz, Native USB CDC / JTAG) |
| **Radio Transceiver**| Semtech SX1262 (915.0 MHz ISM Band, +22 dBm max TX) |
| **Board Revision** | LILYGO T3S3 V1.2 / V1.3 |
| **Antenna** | 915 MHz SMA Male Dipole / High-gain omnidirectional antenna |
| **Indicator** | Onboard Status LED (GPIO 37) |

> [!CAUTION]
> **Antenna Protection Requirement**: Always securely thread the 915 MHz antenna onto the SMA connector **before** plugging the board into USB-C. Transmitting at +22 dBm without an antenna can permanently damage the SX1262 power amplifier due to reflected RF energy.

---

## 3. Environment & Prerequisites

Ensure the following tools are installed:

1. **Python 3.10+** (tested on Python 3.13) with pip.
2. **Node.js 20+** (tested on Node 22) and npm.
3. **PlatformIO Core**:
   - Location: `~/.platformio/penv/Scripts/pio.exe` (or in global `PATH`).
   - Platform: `espressif32 @ 7.0.1`
4. **Git**: Active branch `feat/gateway-setup`.

---

## 4. Instructions for AI Agents & Teammates

### Step 1: Install Dependencies

```powershell
# 1. Python Serial Bridge dependencies
cd c:\SALBAR\services\serial-bridge
pip install -r requirements.txt

# 2. Web Dashboard frontend dependencies
cd c:\SALBAR\apps\web-dashboard
npm install
```

### Step 2: Verify PlatformIO Firmware Configuration

The root configuration file is [`platformio.ini`](file:///c:/SALBAR/platformio.ini). Ensure the target board is explicitly set to `lilygo-t3-s3`:

```ini
[env:t3s3_sx1262]
platform = espressif32
board = lilygo-t3-s3
framework = arduino

board_build.mcu = esp32s3
board_build.f_cpu = 240000000L
board_build.flash_mode = qio

upload_speed = 921600
monitor_speed = 115200

build_flags =
    -D ARDUINO_USB_CDC_ON_BOOT=1
    -D ARDUINO_USB_MODE=1
    -D CORE_DEBUG_LEVEL=1
    -I firmware/shared/include
    -I firmware/gateway/src

lib_deps =
    jgromes/RadioLib @ ^6.6.0
    bblanchon/ArduinoJson @ ^7.0.4
```

To compile the firmware cleanly:
```powershell
& "C:\Users\Jonathan\.platformio\penv\Scripts\pio.exe" run -d c:\SALBAR
```

### Step 3: Flash the LILYGO T3S3 Gateway

1. Connect the LILYGO T3S3 via USB-C.
2. If running, stop any background processes holding the COM port.
3. Flash the firmware:
   ```powershell
   & "C:\Users\Jonathan\.platformio\penv\Scripts\pio.exe" run --target upload
   ```
4. **Mandatory Post-Flash Step (Windows Native USB CDC)**:
   When `esptool.py` finishes and prints `Hard resetting via RTS pin...`, the native USB controller resets. **Unplug and replug the USB-C cable** (or tap the physical **`RST`** button on the side of the T3S3 board). This clears the Windows `usbser.sys` driver state (`Error 31: A device attached to the system is not functioning`).

### Step 4: Start the Web Dashboard Dev Server

In a new terminal:
```powershell
cd c:\SALBAR\apps\web-dashboard
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 5. Verification & Testing Procedures

### A. Testing with Physical Hardware

#### 1. Start the Python Serial Bridge
In Terminal 1:
```powershell
python services/serial-bridge/bridge.py
```
Expected output:
```text
[INFO] Auto-detected ESP32 serial port: COM9
[INFO] server listening on 0.0.0.0:8080
[INFO] ✓ WebSocket server started at ws://localhost:8080
[INFO] Opening serial connection to COM9 @ 115200 baud...
[INFO] ✓ Connected to LoRa Gateway on COM9
[INFO] Dashboard client connected: Total 1
```

#### 2. Test Hardware Ping & Diagnostics
In Terminal 2:
```powershell
python services/serial-bridge/send_cmd.py PING
```
Verified response:
```json
<- Gateway Status: {"type": "GATEWAY_STATUS", "connected": true, "port": "COM9"}
-> Sending command: {"cmd": "PING"}
<- Received: {"type": "DOWNLINK_ACK", "status": "FORWARDED_TO_GATEWAY"}
<- Received: {"status":"PONG","device":"LILYGO_T3S3_SX1262","band":"915MHz","radioReady":true,"rxCount":0,"txCount":0}
```
*Verification Check:* `"radioReady": true` proves the ESP32-S3 communicates with the Semtech SX1262 over SPI and that the 915 MHz RF front-end is active.

#### 3. Test Live Upstream Telemetry
In Terminal 2:
```powershell
python services/serial-bridge/send_cmd.py TELEMETRY
```
Verified response:
```json
<- Received: {"type":"TELEMETRY","srcNode":"SAR-01","rssi":-65,"snr":9.5,"data":{"id":"SAR-01","lat":10.3142,"lng":123.8875,"accuracyMeters":2.4,"kalmanFiltered":true,"batteryVoltage":4.02,"batteryPercent":88,"status":"AVAILABLE","fatigueScore":28,"relayedReportsCount":6}}
```
*Verification Check:* Look at the Tactical GIS Map on **http://localhost:5173**. The `SAR-01` responder marker will update its coordinates, battery voltage (`4.02V / 88%`), and fatigue score (`28`).

#### 4. Test Live Upstream Emergency Report
In Terminal 2:
```powershell
python services/serial-bridge/send_cmd.py INCIDENT
```
Verified response:
```json
<- Received: {"type":"INCIDENT","srcNode":"SAR-01","rssi":-70,"snr":8,"data":{"id":"INC-2026-099","urgency":"CRITICAL","category":"trapped-persons","source":"LORA_MESH_BLE","lat":10.3185,"lng":123.8835,"victimCount":3,"rawText":"Dali! Naay natabunan nga balay sa Sitio Riverside! (Help! House buried at Sitio Riverside!)"}}
```
*Verification Check:* A pulsing red `CRITICAL` marker for `INC-2026-099` appears on the map, and the report appears at the top of the **Live CAD Incident Queue**.

#### 5. Test Live Downlink Over-the-Air Transmission
1. On the web dashboard, click on incident `INC-2026-099` in the queue.
2. In the **HITL Dispatch Authorization Drawer**, click **[Authorize Dispatch]** (or run `python services/serial-bridge/send_cmd.py DISPATCH`).
3. Check the Bridge terminal:
   ```json
   [Dashboard Command Received] {"cmd":"DISPATCH","targetUnit":"SAR-01","incidentIdNum":2026099,"actionCode":0,"notes":"Command approved: proceed to destination."}
   [Gateway Msg] {"status":"DISPATCH_SENT","targetUnit":"SAR-01","incidentIdNum":60019}
   ```
4. Observe the physical **LILYGO T3S3**:
   - The **status LED (GPIO 37) blinks**.
   - The Semtech SX1262 engages the antenna switch and transmits the 915 MHz LoRa packet into the air.

---

### B. Pure Simulation Mode (No Hardware Required)

If hardware is not physically plugged in:
```powershell
python services/serial-bridge/bridge.py --mock
```
- The bridge runs a virtual gateway on `ws://localhost:8080`.
- Telemetry packets for `SAR-01` are automatically broadcast every 5 seconds.
- Downlink dispatch authorizations from the HITL drawer are received and acknowledged with `FORWARDED_TO_GATEWAY_MOCK`.

---

## 6. Architecture & Implementation Highlights

### 1. Embedded Pin Mapping & Radio Settings ([`pins_config.h`](file:///c:/SALBAR/firmware/gateway/src/pins_config.h))
For the LilyGO T3S3 SX1262:
```cpp
#define LORA_SCK       5
#define LORA_MISO      3
#define LORA_MOSI      6
#define LORA_NSS       7
#define LORA_RST       8
#define LORA_BUSY      34
#define LORA_DIO1      33
#define STATUS_LED     37
```
In [`main.cpp`](file:///c:/SALBAR/firmware/gateway/src/main.cpp):
- Explicit SPI initialization: `SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);`
- Antenna switch: `radio.setDio2AsRfSwitch(true);`
- Crystal oscillator: `radio.setTCXO(1.8);`
- Non-blocking interrupt: `radio.setPacketReceivedAction(onPacketReceived);`

### 2. High-Performance Host Daemon ([`bridge.py`](file:///c:/SALBAR/services/serial-bridge/bridge.py))
- **HTTP 431 Protection**: Set `websockets.http11.MAX_LINE_LENGTH = 65536` to prevent browser cookie accumulation on `localhost` from breaking the WebSocket handshake.
- **Concurrency Locks**: Utilizes per-client `asyncio.Lock()` to prevent `ConcurrencyError` during simultaneous downlink sends and serial broadcast reads.
- **Non-blocking Serial Writes**: Avoids PySerial `flush()` which deadlocks on Windows `usbser.sys` CDC endpoints.

### 3. CAD Web Dashboard ([`useGatewayBridge.ts`](file:///c:/SALBAR/apps/web-dashboard/src/hooks/useGatewayBridge.ts))
- Automated reconnection with exponential backoff.
- React 19 Strict Mode safe WebSocket cleanup (defers closing until open).
- Downlink command dispatcher (`sendDispatch`).

---

## 7. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **`WebSocket 431 Request Header Fields Too Large`** | Browser localhost cookies from other projects exceed 8 KB. | Handled automatically in `bridge.py` (`MAX_LINE_LENGTH = 65536`). Alternatively, clear `localhost` cookies in browser settings. |
| **`PermissionError: A device attached to the system is not functioning (31)`** | Windows USB CDC driver stuck after esptool software reset. | Tap the physical **`RST`** button on the T3S3 board or replug the USB-C cable. |
| **PlatformIO `InvalidProjectConfError`** | Syntax error or stray characters on line 1 of `platformio.ini`. | Ensure line 1 begins cleanly with `;` (comment) or `[platformio]`. |
| **`radioReady: false` / `INIT_FAILED`** | SPI bus not configured on pins 5/3/6/7 or TCXO not set. | Recompile using `board = lilygo-t3-s3` and confirm `radio.setDio2AsRfSwitch(true)` and `radio.setTCXO(1.8)`. |
| **Serial writes hang indefinitely** | `serial_conn.flush()` called on Windows native USB CDC. | Do not call `flush()` on PySerial Windows handles; allow the OS and USB endpoints to manage packetization. |

---

## 8. Summary of Files Changed

- [`platformio.ini`](file:///c:/SALBAR/platformio.ini): Upgraded board definition to `lilygo-t3-s3`.
- [`firmware/gateway/platformio.ini`](file:///c:/SALBAR/firmware/gateway/platformio.ini): Synced board target to `lilygo-t3-s3`.
- [`firmware/gateway/src/main.cpp`](file:///c:/SALBAR/firmware/gateway/src/main.cpp): Configured custom SPI bus, DIO2 RF switch, 1.8V TCXO, non-blocking diagnostics, and USB flushes.
- [`services/serial-bridge/bridge.py`](file:///c:/SALBAR/services/serial-bridge/bridge.py): Added 64KB HTTP header capacity, per-client concurrency locks, non-blocking serial writes, and mock downlink handling.
- [`services/serial-bridge/send_cmd.py`](file:///c:/SALBAR/services/serial-bridge/send_cmd.py): Created automated CLI test tool for `PING`, `TELEMETRY`, `INCIDENT`, and `DISPATCH`.
- [`apps/web-dashboard/src/hooks/useGatewayBridge.ts`](file:///c:/SALBAR/apps/web-dashboard/src/hooks/useGatewayBridge.ts): Graceful Strict-Mode connection cleanup.
- [`apps/web-dashboard/src/test/setup.ts`](file:///c:/SALBAR/apps/web-dashboard/src/test/setup.ts): Added isolated test WebSocket mock.
