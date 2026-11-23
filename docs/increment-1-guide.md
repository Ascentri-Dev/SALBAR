# SALBAR Increment 1: System, Hardware & Testing Guide

## 1. Overview and Objectives

This document serves as the authoritative, end-to-end technical reference for **Increment 1** of the SALBAR (System for Allocation and LoRa-Linked Barangay Assessment and Response) platform.

Increment 1 establishes the verified physical and software data pipeline:
1. **Field Response Terminal (`SAR-01`)**: A handheld TTGO T-Beam node reading GPS fixes (Kalman-filtered) and battery levels, executing 4-button triage reporting, and communicating over 915 MHz LoRa.
2. **Gateway Base Station (`GATEWY`)**: A stationary LILYGO T3-S3 base station receiving binary LoRa frames, verifying CRC16 checksums, and streaming structured JSON lines over native USB CDC Serial.
3. **Host Serial Bridge Daemon**: A Python 3.13 service bridging USB serial traffic to a local WebSocket server (`ws://localhost:8080`) with bidirectional command queuing and automatic port recovery.
4. **Operator CAD Web Dashboard**: A React 19 + TypeScript + Leaflet mission control interface displaying real-time tactical map pins, incoming incident streams, and providing Human-in-the-Loop (HITL) dispatch downlink controls.

```
+---------------------------------------------------------------------------------------+
|                                INCREMENT 1 DATA PIPELINE                              |
+---------------------------------------------------------------------------------------+

 [ TTGO T-Beam V1.2 (SAR-01) ]
       |
       | 915 MHz LoRa (Bit-Packed Binary Structs + CRC16)
       v
 [ LILYGO T3-S3 Gateway (GATEWY) ]
       |
       | Native USB CDC Serial (115200 baud, JSON Lines over COM5)
       v
 [ Python Serial Bridge (services/serial-bridge/bridge.py) ]
       |
       | Bidirectional WebSockets (ws://localhost:8080)
       v
 [ Operator Web Dashboard (apps/web-dashboard) ]
       |-- Tactical GIS Map (SAR-01 teardrop vector pin tracking)
       |-- Live Incident Triage Stream
       \-- HITL Dispatch Approval ---> Over-the-air LoRa Downlink to Field Terminal
```

---

## 2. Hardware Specifications

| Component | Gateway Base Station | Field Response Terminal |
| :--- | :--- | :--- |
| **Model** | LILYGO T3-S3 V1.2 / V1.3 | LILYGO TTGO T-Beam V1.1 / V1.2 |
| **Microcontroller** | ESP32-S3 (Xtensa Dual-Core LX7, 240MHz) | ESP32-D0WDQ6 (Xtensa Dual-Core LX6, 240MHz) |
| **LoRa Transceiver**| Semtech SX1262 (915.0 MHz ISM band) | Semtech SX1276 (915.0 MHz ISM band) |
| **Maximum TX Power**| +22 dBm | +20 dBm (clamped for SX1276 hardware limit) |
| **GNSS Module** | N/A (Stationary Base Station) | u-blox NEO-6M (UART1 on RX 34 / TX 12) |
| **Power Management**| USB-C Bus Powered (5V) | AXP192 or AXP2101 (Auto-probed via XPowersLib) |
| **Display** | N/A (Optional onboard I2C) | 0.96-inch / 1.3-inch SSD1306 OLED (I2C 0x3C) |
| **Controls** | BOOT (GPIO 0), RST | 4-button triage matrix (GPIO 13, 14, 15, 25) |
| **Primary Port** | Windows `COM5` (typical) | Windows `COM6` (typical) |

> [!CAUTION]
> **Antenna Protection Requirement**: Always securely thread the 915 MHz SMA whip/dipole antennas onto **both** boards before applying USB or battery power. Operating the Semtech transceivers at +20 to +22 dBm without an antenna can permanently destroy the internal RF power amplifiers due to reflected energy.

---

## 3. Over-the-Air RF Configuration & Shared Protocol

Both the T3-S3 Gateway and TTGO T-Beam firmware share the common protocol definitions in `firmware/shared/include/salbar_protocol.h`.

### RF Modulation Standard (915 MHz ISM Band)
- **Carrier Frequency**: `915.0 MHz`
- **Bandwidth**: `125.0 kHz`
- **Spreading Factor (SF)**: `SF9` (balanced range, obstacle penetration, and time-on-air)
- **Coding Rate (CR)**: `4/7` (`CR = 7`)
- **Sync Word**: `0x12` (private network sync word)
- **Preamble Length**: `8 symbols`

### Binary Frame Layouts
All over-the-air packets are bit-packed C structs preceded by a universal 10-byte header:

1. **`SalbarHeader` (10 bytes)**:
   - `magic` (`0x5341` / `'SA'`)
   - `version` (`0x01`)
   - `msgType` (`0x01` Telemetry, `0x02` Incident, `0x03` Dispatch, `0x04` ACK)
   - `seqNumber` (16-bit monotonic sequence counter)
   - `srcNode` (8-byte fixed string, e.g., `SAR-01`)
   - `destNode` (8-byte fixed string, e.g., `GATEWY`)

2. **`SalbarTelemetryPayload` (24 bytes)**:
   - Fixed-point coordinates: `latitude` ($lat \times 10^7$) and `longitude` ($lng \times 10^7$)
   - `accuracyCm` (computed by recursive Kalman filter)
   - `batteryMillivolts` and `batteryPercent`
   - `status` (`0` Available, `1` En Route, `2` On Scene, `3` Rest, `4` Offline)
   - `fatigueScore` (0-100 workload metric)
   - `kalmanFiltered` (boolean flag)

3. **`SalbarIncidentPayload` (128 bytes max)**:
   - `incidentId` (numeric identifier)
   - `urgency` (`0` Low, `1` Moderate, `2` High, `3` Critical)
   - `category` (0 Trapped, 1 Landslide, 2 Medical, 3 Flood, 4 Supplies)
   - `source` (`0` Resident Mobile BLE, `1` Field Responder Manual)
   - Fixed-point coordinates and `victimCount`
   - `rawText` (null-terminated UTF-8 string for local dialect or notes)

4. **Checksum**:
   - Every transmitted frame terminates with a CCITT CRC16 calculation (`salbar_crc16`). Packets failing CRC verification are dropped at the gateway before reaching serial.

---

## 4. Hardware Pin Configurations

### LILYGO T3-S3 SX1262 Gateway Base Station
Source: `firmware/gateway/src/pins_config.h`

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

### TTGO T-Beam V1.2 SX1276 Field Terminal
Source: `firmware/field-terminal/src/pins_config.h`

```cpp
// LoRa SPI & Interrupts
#define LORA_SCK       5
#define LORA_MISO      19
#define LORA_MOSI      27
#define LORA_NSS       18
#define LORA_RST       23
#define LORA_DIO0      26
#define LORA_DIO1      33

// GNSS UART
#define GPS_RX_PIN     34
#define GPS_TX_PIN     12
#define GPS_BAUDRATE   9600

// I2C OLED Display
#define I2C_SDA_PIN    21
#define I2C_SCL_PIN    22
#define OLED_ADDR      0x3C

// 4-Button Field Triage Matrix (Active LOW, internal pull-up)
#define BTN_NAV_UP     13   // Button 1: Previous Category / Menu Item
#define BTN_NAV_DOWN   14   // Button 2: Next Category / Menu Item
#define BTN_SELECT     15   // Button 3: Select / Confirm Urgency
#define BTN_SEND       25   // Button 4: Back (one menu level up)

// Power & Status
#define STATUS_LED     4
```

---

## 5. Environment Prerequisites

Ensure the following runtimes and compilers are installed:
1. **Python 3.10+** (tested on Python 3.13) with pip.
2. **Node.js 20+** (tested on Node 22) and npm.
3. **PlatformIO Core**:
   - Path: `$env:USERPROFILE\.platformio\penv\Scripts\pio.exe`
   - Platform: `espressif32 @ 7.0.1`

---

## 6. Firmware Compilation and Flashing

### Step 1: Flash the TTGO T-Beam (Field Terminal)
Connect the TTGO T-Beam via USB (ensure 915 MHz antenna is securely attached):

```powershell
cd firmware/field-terminal
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e tbeam_sx1276 --target upload
```

### Step 2: Flash the LILYGO T3-S3 (Gateway Base Station)
Connect the LILYGO T3-S3 via USB-C (ensure 915 MHz antenna is securely attached):

```powershell
cd ../..
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e t3s3_sx1262 --target upload
```

> [!TIP]
> **T3-S3 Bootloader Recovery Mode**:
> If the T3-S3 upload fails with `Could not find port` or times out connecting:
> 1. Press and **HOLD the `BOOT` button**.
> 2. Press and release the **`RST` button** once.
> 3. Release the **`BOOT` button**.
> 4. Run the upload command again.
> 5. After flashing, press the `RST` button once to boot the newly flashed firmware.

### Alternative Web Flasher (Zero-Install Flashing for Teammates)
If flashing on a machine without Python or PlatformIO installed:
1. Open Google Chrome and navigate to: `https://espressif.github.io/esptool-js/`
2. Select Baud Rate `115200` or `460800` and click **Connect**.
3. Select the ESP32 serial port.
4. Program the three binary files generated in `.pio/build/t3s3_sx1262/`:
   - `bootloader.bin` at Flash Address `0x0`
   - `partitions.bin` at Flash Address `0x8000`
   - `firmware.bin` at Flash Address `0x10000`
5. Click **Program**.

---

## 7. Host Software Setup

### 1. Install Serial Bridge Dependencies
```powershell
cd services/serial-bridge
pip install -r requirements.txt
```
Installs `pyserial>=3.5`, `websockets>=12.0`, and `colorama>=0.4.6`.

### 2. Install Web Dashboard Dependencies
```powershell
cd ../../apps/web-dashboard
npm install
```
Installs React 19, TypeScript, Vite, Leaflet, and Tailwind CSS.

---

## 8. Multi-Device Execution (Running the Live System)

When both the LILYGO T3-S3 Gateway and TTGO T-Beam are connected to the same PC, Windows assigns them separate COM ports (typically `COM5` for the Gateway and `COM6` for the Field Terminal).

Check connected ports with PlatformIO:
```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device list
```

### Terminal 1: Start the Python Serial Bridge Daemon
Run the bridge daemon targeting the **Gateway Base Station** port:
```powershell
cd services/serial-bridge
python bridge.py --port COM5
```
Expected output:
```text
[INFO] server listening on 0.0.0.0:8080
[INFO] WebSocket server started at ws://localhost:8080
[INFO] Opening serial connection to COM5 @ 115200 baud...
[INFO] Connected to LoRa Gateway on COM5
```

### Terminal 2: Start the Operator Web Dashboard
```powershell
cd apps/web-dashboard
npm run dev
```
Open `http://localhost:5173` in a browser. The ambient status banner will indicate that the Gateway is connected and online.

### Terminal 3 (Optional): Open Field Terminal Serial Console
To interact with the T-Beam menu, view telemetry status, or trigger alerts via keyboard:
```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device monitor -p COM6 -b 115200
```

---

## 9. 4-Button Field Triage Navigation and Serial CLI

The field terminal firmware implements a 4-button menu state machine for handheld triage operation.

### Physical Tactile Switch Connections
- **Button 1 (`GPIO 13`)**: Navigate Up (previous incident category).
- **Button 2 (`GPIO 14`)**: Navigate Down (next incident category).
- **Button 3 (`GPIO 15`)**: Select / Confirm. Category → Urgency (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`) → Confirm screen. On the Confirm screen, Button 3 broadcasts `SALBAR_MSG_INCIDENT` over LoRa.
- **Button 4 (`GPIO 25`)**: Back. Confirm → Urgency → Category → Standby screen.

*(Note: Pins use internal pull-ups and are active LOW. If buttons are not yet physically wired, the pins rest safely at 3.3V without accidental triggers).*

### Interactive Serial CLI Commands
When monitoring `COM6` in the serial terminal, you can interact directly using single-character keys or keywords:

| Key / Command | Action | Description |
| :--- | :--- | :--- |
| `1` or `UP` | Button 1: Up | Scroll up through categories: `Trapped Persons`, `Landslide Hazard`, `Medical Emerg.`, `Flood Inundation`, `Relief Supplies`. |
| `2` or `DOWN` | Button 2: Down | Scroll down through triage categories. |
| `3` or `S` / Enter | Button 3: Select | Advance Category → Urgency → Confirm. On the Confirm screen, transmits `SALBAR_MSG_INCIDENT` over 915 MHz LoRa. |
| `4` or `B` | Button 4: Back | Go back one menu level (Confirm → Urgency → Category → Standby). |
| `T` or `TELEMETRY` | Manual Telemetry | Forces immediate transmission of GPS and battery telemetry to Gateway. |
| `I` or `INCIDENT` | Instant SOS Alert | Sends a quick critical bench-test incident directly to the dashboard. |
| `H` or `HELP` | Help Menu | Displays the command reference list in the console. |

The serial monitor renders a color-coded simulation of the handheld OLED without background flickering:

```text
+================================================================+
| [SALBAR] T-BEAM SAR-01 | SX1276 915.0MHz                       |
+----------------------------------------------------------------+
| GPS:  10.315700, 123.885400 (FALLBACK/INDOOR)                  |
| ACC:  0.0 m | SAT: 0 | FIX: NO                                 |
| BATT: 4.02V (88%) | STATUS: AVAILABLE                          |
| LORA: TX_PKTS=12 | RX_PKTS=1 | LAST_RSSI=-68dBm                |
+----------------------------------------------------------------+
| MENU: SELECT CATEGORY                                          |
|  [ ] 1. Trapped Persons                                        |
| >[*] 2. Landslide Hazard                                       |
|  [ ] 3. Medical Emerg.                                         |
|  [ ] 4. Flood Inundation                                       |
|  [ ] 5. Relief Supplies                                        |
| URGENCY: [CRITICAL]                                            |
+----------------------------------------------------------------+
| [1] UP  [2] DOWN  [3] SELECT  [4] BACK  [T] TX TELEM  [I] SOS  |
+================================================================+
```

---

## 10. End-to-End Verification Milestones

| Milestone | Action | Verification Criteria |
| :--- | :--- | :--- |
| **1. Gateway Online** | Connect T3-S3 to `COM5` and start `bridge.py` | Dashboard top bar shows `GATEWAY: ONLINE (COM5 / 915 MHz)`. |
| **2. Upstream Telemetry** | Power TTGO T-Beam on `COM6` or battery | Within 10 seconds, `bridge.py` logs `TELEMETRY from SAR-01`. The clean vector teardrop pin for `SAR-01` appears on the Leaflet Tactical Map with accurate coordinates, battery %, and fatigue score. |
| **3. 4-Button Incident Alert** | In T-Beam serial console, press `2` &rarr; `3` &rarr; `3` &rarr; `3` (or press physical switches) | T-Beam logs `[TX] INCIDENT`. `bridge.py` logs packet reception. The incident instantly prepends to the CAD queue and drops a vector marker pin on the map. |
| **4. HITL Dispatch Downlink** | In Web Dashboard, click the incident card, then click **[Approve & Dispatch via LoRa]** | Gateway transmits the dispatch order. T-Beam logs `[RX] DISPATCH for SAR-01` over serial/OLED and transitions status to `EN_ROUTE`. |
| **5. Mock Simulation Mode** | Run `python bridge.py --mock` (no hardware connected) | Virtual gateway broadcasts simulated telemetry and acknowledges dispatch commands with `FORWARDED_TO_GATEWAY_MOCK`. |

---

## 11. Troubleshooting Reference

| Symptom | Probable Cause | Remediation |
| :--- | :--- | :--- |
| **`PermissionError: Access is denied (COMx)`** | Another process (e.g., serial monitor, prior bridge instance) holds the COM port open. | Terminate the process using the port (`Ctrl+C` in terminal) or re-run `bridge.py` specifying the dedicated gateway port (`--port COM5`). |
| **`FileNotFoundError: The system cannot find the file specified`** | The microcontroller is plugged in but powered off, or the USB cable is power-only. | Verify data cable. Ensure the board power switch is turned ON. Verify enumeration via `pio device list`. |
| **Windows Driver Error 31 (`Device not functioning`)** | Native USB CDC endpoint stuck following an `esptool.py` software reset. | Tap the physical `RST` button on the side of the T3-S3 board or briefly replug the USB-C cable. |
| **`radioReady: false` / LoRa Init Failed** | SPI bus not mapped to pins 5/3/6/7, or TCXO not initialized. | Ensure firmware is compiled using `board = lilygo-t3-s3` and that `radio.setDio2AsRfSwitch(true)` and `radio.setTCXO(1.8)` are configured in `main.cpp`. |
| **WebSocket HTTP 431 Header Overflow** | Browser localhost cookie buildup exceeds default 8 KB HTTP buffer. | Addressed in `bridge.py` with `MAX_LINE_LENGTH = 65536`. Alternatively, clear browser cookies for `localhost`. |
