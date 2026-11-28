# SALBAR Increment 1: System, Hardware & Testing Guide

## 1. Overview and Objectives

This document serves as the authoritative, end-to-end technical reference for **Increment 1** of the SALBAR (System for Allocation and LoRa-Linked Barangay Assessment and Response) platform.

Increment 1 establishes the verified physical and software data pipeline:
1. **Field Response Terminal (`SAR-01`)**: A handheld TTGO T-Beam node reading GPS fixes (u-blox NEO-6M, Kalman-filtered) and battery levels, executing 4-button triage reporting, and communicating over 915 MHz LoRa.
2. **Gateway Base Station (`GATEWY`)**: A stationary LILYGO T3-S3 base station receiving binary LoRa frames, verifying CRC16 checksums, and streaming structured JSON lines over native USB CDC Serial.
3. **Host Serial Bridge Daemon**: A Python 3.13 service bridging USB serial traffic to a local WebSocket server (`ws://localhost:8080`) with bidirectional command queuing and automatic port recovery.
4. **Operator CAD Web Dashboard**: A React 19 + TypeScript + Leaflet mission control interface displaying real-time tactical map pins, incoming incident streams, and providing Human-in-the-Loop (HITL) dispatch downlink controls.

```text
+---------------------------------------------------------------------------------------+
|                                INCREMENT 1 DATA PIPELINE                              |
+---------------------------------------------------------------------------------------+

 [ TTGO T-Beam V1.2 (SAR-01) ]
       |
       | 915 MHz LoRa (Bit-Packed Binary Structs + CRC16)
       v
 [ LILYGO T3-S3 Gateway (GATEWY) ]
       |
       | Native USB CDC Serial (115200 baud, JSON Lines over COMx)
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
| **Microcontroller** | ESP32-S3 (Xtensa Dual-Core LX7, 240 MHz) | ESP32-D0WDQ6 (Xtensa Dual-Core LX6, 240 MHz) |
| **LoRa Transceiver**| Semtech SX1262 (915.0 MHz ISM band) | Semtech SX1276 (915.0 MHz ISM band) |
| **Maximum TX Power**| +22 dBm | +20 dBm (clamped for SX1276 hardware limit) |
| **GNSS Module** | N/A (Stationary Base Station) | u-blox NEO-6M (UART1 on RX 34 / TX 12, 9600 baud) |
| **Power Management**| USB-C Bus Powered (5V) | AXP192 or AXP2101 (Auto-probed via XPowersLib) |
| **Display** | N/A (Optional onboard I2C) | 0.96-inch SSD1306 or 1.3-inch SH1106 OLED (I2C `0x3C`) |
| **Controls** | BOOT (GPIO 0), RST | 4-button triage matrix (GPIO 13, 14, 15, 25) |
| **USB Serial ID** | `USB Serial Device` (VID:PID `303A:1001`, e.g. `COM5`/`COM9`) | `USB-Enhanced-SERIAL CH9102` (e.g. `COM6`/`COM10`) |

> [!CAUTION]
> **Antenna Protection Requirement**: Always securely thread the 915 MHz SMA whip/dipole antennas onto **both** boards before applying USB or battery power. Operating the Semtech transceivers at +20 to +22 dBm without an antenna can permanently destroy the internal RF power amplifiers due to reflected energy.

---

## 3. Over-the-Air RF Configuration & Shared Protocol

Both the T3-S3 Gateway and TTGO T-Beam firmware share the common protocol definitions in [`firmware/shared/include/salbar_protocol.h`](../../firmware/shared/include/salbar_protocol.h). Changing `SalbarTelemetryPayload` or any shared struct requires reflashing **both** boards.

### RF Modulation Standard (915 MHz ISM Band)
- **Carrier Frequency**: `915.0 MHz`
- **Bandwidth**: `125.0 kHz`
- **Spreading Factor (SF)**: `SF9` (balanced range, obstacle penetration, and time-on-air)
- **Coding Rate (CR)**: `4/7` (`CR = 7`)
- **Sync Word**: `0x12` (private network sync word)
- **Preamble Length**: `8 symbols`

### Binary Frame Layouts
All over-the-air packets are bit-packed C structs preceded by a universal header:

1. **`SalbarHeader`**:
   - `magic` (`0x5341` / `'SA'`)
   - `version` (`0x01`)
   - `msgType` (`0x01` Telemetry, `0x02` Incident, `0x03` Dispatch, `0x04` ACK)
   - `seqNumber` (16-bit monotonic sequence counter)
   - `srcNode` (8-byte fixed string, e.g., `SAR-01`)
   - `destNode` (8-byte fixed string, e.g., `GATEWY`)

2. **`SalbarTelemetryPayload`**:
   - Fixed-point coordinates: `latitude` ($lat \times 10^7$) and `longitude` ($lng \times 10^7$)
   - `accuracyCm` (computed by recursive Kalman filter)
   - `batteryMillivolts` and `batteryPercent`
   - `status` (`0` Available, `1` En Route, `2` On Scene, `3` Rest, `4` Offline)
   - `fatigueScore` (0–100 workload metric)
   - `flags`: bit 0 = live fix, bit 1 = GPS module streaming, bits 2–7 = satellites used
   - GPS & UBX diagnostics: `sats_in_view`, `sats_tracked`, `sats_strong`, `max_snr`, `gps_receiver` (GSA/RMC/GGA state), `ubx_eph`, `ubx_locked`, `ubx_used`

3. **`SalbarIncidentPayload` (128 bytes max)**:
   - `incidentId` (numeric identifier)
   - `urgency` (`0` Low, `1` Moderate, `2` High, `3` Critical)
   - `category` (`0` Trapped, `1` Landslide, `2` Medical, `3` Flood, `4` Supplies)
   - `source` (`0` Resident Mobile BLE, `1` Field Responder Manual)
   - Fixed-point coordinates, `pos_age_s` (`0` = live fix, `1..65534` = seconds since last known real fix, `0xFFFF` = none), and `victimCount`
   - `rawText` (null-terminated UTF-8 string for local dialect or notes)

4. **Checksum**:
   - Every transmitted frame terminates with a CCITT CRC16 calculation (`salbar_crc16`). Packets failing CRC verification are dropped at the gateway before reaching serial.

> [!NOTE]
> **No Fake Fallback Coordinates**: The system never transmits or displays hardcoded fallback coordinates. Without a GPS fix, telemetry sends `0, 0` with the no-fix flag (`Lat=----------` in the bridge log; amber `GPS ACQUIRING` chip and no map pin on the dashboard). Incidents without a live fix carry the last-known real position and its age (`pos_age_s`), rendered as a faded dashed pin labeled `"Last known position, N s old"`.

---

## 4. Hardware Pin Configurations & Breadboard Wiring

### LILYGO T3-S3 SX1262 Gateway Base Station
Source: [`firmware/gateway/src/pins_config.h`](../../firmware/gateway/src/pins_config.h)

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
Source: [`firmware/field-terminal/src/pins_config.h`](../../firmware/field-terminal/src/pins_config.h)

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
#define BTN_SELECT     15   // Button 3: Select / Confirm / Send Incident
#define BTN_SEND       25   // Button 4: Back (one menu level up)

// Power & Status
#define STATUS_LED     4
```

### Breadboard Wiring (OLED + 4 Buttons)

#### Parts Needed
- T-Beam with 915 MHz LoRa antenna, GPS patch antenna, and 3.7 V 18650 cell
- Full-size 830-point breadboard (columns 1–63, rows `a–e` top half and `f–j` bottom half, `+`/`-` power rails)
- I2C OLED module (4 pins; 0.96-inch SSD1306 or 1.3-inch SH1106)
- 4 tactile push buttons (6 mm, 4 legs)
- ~6 female-to-male jumper wires (T-Beam header to breadboard) + ~6 short male-to-male jumper wires

> [!IMPORTANT]
> - Keep the T-Beam **off the breadboard** (it is too wide; sit it beside the board and connect with jumpers).
> - Ensure header pins are **soldered** on the T-Beam; loose male jumpers in bare holes cause intermittent shorts and dropouts.
> - Do all wiring with the T-Beam **switched off and USB unplugged**.

#### Breadboard Layout
```text
 TOP RAIL    (+) red  = 3V3   ─────────────────────────────────────
             (-) blue = GND   ─────────────────────────────────────
 row a       . . . . . . . . . . . . . . . . . . . . . . . . . . .
 row b-d     OLED jumpers       (cols 3-6)
 row e       [OLED pins 3-6]    B1 20|22   B2 28|30   B3 36|38   B4 44|46
             ═══════════════════ center gap ═══════════════════════
 row f       buttons straddle the gap (legs in rows e and f)
 row g-j     GPIO jumpers land here (cols 22, 30, 38, 46)
 BOTTOM RAIL (unused)
```

#### Step 1: Power Rails
1. Jumper T-Beam **GND** to the top **blue (-)** rail.
2. Jumper T-Beam **3V3** to the top **red (+)** rail.
3. If your breadboard splits the rails in the middle (around column 30), bridge the gap on both red and blue rails with short jumpers.
4. **Never** connect `5V` or `VBAT` to the rails.

#### Step 2: OLED (Columns 3–6)
1. Check the pin labels printed on your OLED module (`GND VCC SCL SDA` or `VCC GND SCK SDA`). **Swapping GND and VCC can destroy the module.**
2. Insert the OLED's 4 pins into **e3, e4, e5, e6**, screen facing you. (If the OLED body covers rows `a–d`, insert the jumpers before seating the OLED.)
3. Connect jumpers according to your module's pin labels:

| OLED Pin | T-Beam Pin | Breadboard Rail / Notes |
| :--- | :--- | :--- |
| **GND** | `GND` | Top blue (`-`) rail |
| **VCC** | `3V3` | Top red (`+`) rail (`3V3`, never `5V`) |
| **SCL / SCK** | **GPIO 22** | Do **not** use the T-Beam pin labeled `SCK` (GPIO 5, LoRa SPI clock) |
| **SDA** | **GPIO 21** | Shared with the AXP power management chip (normal for I2C) |

*(Note: `firmware/field-terminal/platformio.ini` uses `adafruit/Adafruit SH110X` for 1.3-inch SH1106 OLEDs at `0x3C`. If using a 0.96-inch SSD1306 and the image is garbled/shifted, switch the driver accordingly. The firmware only probes the OLED once at boot, so reboot after fixing wires.)*

#### Step 3: 4 Triage Buttons (Straddling the Center Gap)
Place each button with 2 legs in row **e** and 2 legs in row **f**, straddling the center gap. Wire each button **diagonally** (GND on top-left column, GPIO on bottom-right column) so it works regardless of rotation. No resistors are needed (`INPUT_PULLUP`, active LOW).

| Button | Function | Legs in Columns | GND Jumper | GPIO Jumper |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Up / Open Menu | `20` and `22` | `a20` to blue (`-`) rail | `i22` to T-Beam **GPIO 13** |
| **2** | Down | `28` and `30` | `a28` to blue (`-`) rail | `i30` to T-Beam **GPIO 14** |
| **3** | Select / Send | `36` and `38` | `a36` to blue (`-`) rail | `i38` to T-Beam **GPIO 15** |
| **4** | Back | `44` and `46` | `a44` to blue (`-`) rail | `i46` to T-Beam **GPIO 25** |

Do **not** wire buttons to GPIO `34, 12, 21, 22, 5, 18, 19, 23, 26, 27, 33` (reserved for GPS, LoRa, PMU, OLED).

#### Pre-Power Check
- Count the jumpers to the T-Beam: **8 wires** (`GND`, `3V3`, `21`, `22`, `13`, `14`, `15`, `25`).
- No button connects to the red (`+`) rail; OLED VCC goes to `3V3`.
- 915 MHz LoRa antenna is screwed on; GPS patch antenna is flat and facing skyward; battery polarity matches the `+` mark.

---

## 5. Environment Prerequisites & Host Software Setup

### Prerequisites
1. **Python 3.10+** (tested on Python 3.13) with `pip`.
2. **Node.js 20+** (tested on Node 22) and `npm`.
3. **PlatformIO Core**: `$env:USERPROFILE\.platformio\penv\Scripts\pio.exe` (`espressif32 @ 7.0.1`).

### Install Host Dependencies
```powershell
# 1. Serial Bridge (pyserial, websockets, colorama)
cd services/serial-bridge
pip install -r requirements.txt

# 2. Web Dashboard (React 19, TypeScript, Vite, Leaflet, Tailwind CSS)
cd ../../apps/web-dashboard
npm install
```

---

## 6. Firmware Compilation and Flashing

> [!WARNING]
> Only **one** program can open a COM port at a time. Stop `bridge.py` (`Ctrl+C`) before flashing the Gateway, and close the PlatformIO serial monitor before flashing the T-Beam. Always pass `--upload-port` when both boards are connected.

First, check connected ports:
```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device list
```

### Step 1: Flash the TTGO T-Beam (Field Terminal)
Run from `firmware/field-terminal` (replace `COM10` with your T-Beam port):
```powershell
cd firmware/field-terminal
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e tbeam_sx1276 -t upload --upload-port COM10
```

### Step 2: Flash the LILYGO T3-S3 (Gateway Base Station)
Run from the repo root (replace `COM9` with your Gateway port):
```powershell
cd ../..
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e t3s3_sx1262 -t upload --upload-port COM9
```

> [!TIP]
> **T3-S3 Bootloader Recovery Mode**: If the T3-S3 upload fails with `Could not find port` or times out:
> 1. Press and **HOLD `BOOT`**.
> 2. Tap **`RST`** once.
> 3. Release **`BOOT`**.
> 4. Re-run the upload command, then tap **`RST`** once after flashing.

### Alternative Web Flasher (Zero-Install)
If flashing on a machine without PlatformIO:
1. Open Chrome and go to `https://espressif.github.io/esptool-js/`.
2. Connect at `115200` or `460800` baud and select the ESP32 serial port.
3. Flash the binaries from `.pio/build/t3s3_sx1262/`:
   - `bootloader.bin` at `0x0`
   - `partitions.bin` at `0x8000`
   - `firmware.bin` at `0x10000`

---

## 7. Multi-Device Execution (Running the Live System)

### Terminal 1: Python Serial Bridge Daemon (Gateway)
```powershell
cd services/serial-bridge
python bridge.py --port COM9
```
Expected output:
```text
[INFO] server listening on 0.0.0.0:8080
[INFO] WebSocket server started at ws://localhost:8080
[INFO] Opening serial connection to COM9 @ 115200 baud...
[INFO] Connected to LoRa Gateway on COM9
```
*(For UI testing without hardware, run `python bridge.py --mock`.)*

### Terminal 2: Operator Web Dashboard
```powershell
cd apps/web-dashboard
npm run dev
```
Open `http://localhost:5173` in a browser. The top status banner indicates `GATEWAY: ONLINE`.

### Terminal 3 (Optional): T-Beam Serial Monitor
```powershell
cd firmware/field-terminal
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device monitor -p COM10 -b 115200 --filter direct
```
Press **`H`** to draw the screen (it only redraws on key presses and events, so it starts blank if the board booted before the monitor opened). Use Windows Terminal or the VS Code terminal for ANSI colors.

---

## 8. Field Triage Navigation, Serial CLI & GPS Reference

### 4-Button Navigation & Serial CLI Keys

| Key | Physical Button | Action | Description |
| :--- | :--- | :--- | :--- |
| `1` / `UP` | Button 1 (`GPIO 13`) | Up / Open Menu | Scroll up through categories: `Trapped Persons`, `Landslide Hazard`, `Medical Emerg.`, `Flood Inundation`, `Relief Supplies`. |
| `2` / `DOWN` | Button 2 (`GPIO 14`) | Down | Scroll down through triage categories. |
| `3` / `S` / Enter | Button 3 (`GPIO 15`) | Select / Send | Advance Category → Urgency (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`) → Confirm. On Confirm, **sends** `SALBAR_MSG_INCIDENT` over LoRa. |
| `4` / `B` | Button 4 (`GPIO 25`) | Back | Go back one menu level (Confirm → Urgency → Category → Standby). |
| `T` | — | Manual Telemetry | Forces immediate GPS and battery telemetry transmission. |
| `I` | — | Instant SOS Alert | Sends a quick critical bench-test incident. |
| `H` | — | Help / Redraw | Redraws the OLED/serial console screen and lists commands. |
| `R` | — | GPS Factory Reset | Sends UBX CFG-CFG + hot restart. **Avoid during field tests** as it erases stored satellite almanac/ephemeris. |

Quick report sequence: `1` (open menu) → `3` (choose category) → `3` (choose urgency) → `3` (send).

### GPS Status Reference

| Where | No Fix Yet | Fix Acquired | GPS Module Problem |
| :--- | :--- | :--- | :--- |
| **Bridge log** | `GPS=ACQUIRING sats=N` (`Lat=----------`) | `GPS=FIX Lat=... Lng=... +/-Xm sats=N` | `GPS=NO_DATA (module silent)` |
| **Dashboard** | Amber chip `SAR-01: GPS ACQUIRING`, no pin | Chip disappears, `SAR-01` pin on map | Red chip `GPS MODULE NOT RESPONDING` |
| **T-Beam screen** | `GPS: ACQUIRING` | `GPS: FIX (LIVE GPS)` | `GPS: NO DATA` |

- **First Fix Timing**: Needs open sky (outdoors, patch antenna flat and facing up). Cold start takes ~5–20 minutes while UBX ephemeris downloads (`in_view` / `tracked` / `strong` show progress; `sats` stays `0` until fix). Warm start (<2–4 hours off) takes under 1 minute.

---

## 9. Verification Milestones & 10-Trial Field Test

### System Verification Milestones

| Milestone | Action | Verification Criteria |
| :--- | :--- | :--- |
| **1. Gateway Online** | Connect T3-S3 and start `bridge.py --port COM9` | Dashboard top bar shows `GATEWAY: ONLINE (COM9 / 915 MHz)`. |
| **2. Upstream Telemetry** | Power TTGO T-Beam on USB or battery | Within 10 s, `bridge.py` logs `TELEMETRY from SAR-01`. `SAR-01` pin appears on the Tactical Map (under Handheld Devices filter once GPS fix is acquired). |
| **3. 4-Button Incident Alert** | Press `1` → `3` → `3` → `3` (or physical buttons) | T-Beam logs `[TX] INCIDENT`. `bridge.py` logs reception; incident prepends to CAD queue and drops a map marker. |
| **4. HITL Dispatch Downlink** | Click incident card in Dashboard → **[Approve & Dispatch via LoRa]** | Gateway transmits dispatch order. T-Beam logs `[RX] DISPATCH for SAR-01` and transitions status to `EN_ROUTE`. |
| **5. Mock Simulation Mode** | Run `python bridge.py --mock` | Virtual gateway broadcasts simulated telemetry and acknowledges dispatch with `FORWARDED_TO_GATEWAY_MOCK`. |

### 10-Trial Physical Button Field Test
Run 10 trials using the physical buttons (T-Beam powered by 18650 cell or power bank, no laptop needed at the T-Beam). Vary conditions: next to the gateway, another floor, outside, farther away.

For each trial:
1. Confirm the OLED shows a GPS fix.
2. Press **Button 1**, choose a category with **Button 3**, choose urgency with **Button 3**, then press **Button 3** to send.
3. Note the time of the final Send press.
4. Copy the incident line from the bridge log and verify the pin on the dashboard (take a screenshot).
5. Record the true coordinates of the spot (long-press in Google Maps).

| # | Date/Time | T-Beam Location | Category / Urgency | Sent at | Received at | Delay (s) | RSSI (dBm) | Reported Lat, Lng | True Lat, Lng | GPS Error (m) | Shown on Dashboard? | Result (Pass/Fail) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | |
| 6 | | | | | | | | | | | | |
| 7 | | | | | | | | | | | | |
| 8 | | | | | | | | | | | | |
| 9 | | | | | | | | | | | | |
| 10 | | | | | | | | | | | | |

**Summary**: Success rate (`x/10`), average delay, average RSSI, average GPS error.

---

## 10. Troubleshooting Reference

| Symptom | Probable Cause | Remediation |
| :--- | :--- | :--- |
| **`Access is denied (COMx)`** | Another process (bridge, serial monitor, Arduino IDE) holds the port open. | Close the other process (`Ctrl+C`) and re-run specifying the target port (`--port COM9`). |
| **`Not a PlatformIO project`** | Running `pio` from the wrong directory. | Gateway: repo root (`C:\SALBAR`). T-Beam: `firmware/field-terminal`. |
| **`FileNotFoundError` / Port missing** | Board powered off or power-only USB cable. | Verify data cable and power switch. T-Beam (AXP2101) powers on when USB is plugged in; hold `PWR` ~6 s to turn off. |
| **Windows Error 31 / Gateway undetected** | Native USB CDC endpoint stuck after `esptool.py` reset. | Tap physical `RST` on the T3-S3 or replug the USB-C cable. |
| **`radioReady: false` / LoRa Init Failed** | SPI bus mismatch or TCXO not initialized. | Compile with `board = lilygo-t3-s3` and ensure `radio.setDio2AsRfSwitch(true)` and `radio.setTCXO(1.8)` are set. |
| **OLED blank / garbled / shifted** | Wrong VCC/GND, loose jumper, or SSD1306 vs SH1106 driver mismatch. | Verify `3V3`/`GND`/`21`/`22` (not GPIO 5 `SCK`). Reboot after wiring (probed once at boot). Check `Adafruit_SH1106G` vs `Adafruit_SSD1306`. |
| **Button silent or fires constantly** | Rotated button or legs shorted to GND. | Wire diagonally across the center gap (`e`/`f`). |
| **`[36m` codes or broken box in monitor** | Terminal lacks ANSI color support or is too narrow. | Use Windows Terminal or VS Code terminal (at least 70 columns wide), or add `--filter nocontrol`. |
| **WebSocket HTTP 431 Header Overflow** | Browser localhost cookie buildup exceeds 8 KB buffer. | Handled in `bridge.py` (`MAX_LINE_LENGTH = 65536`), or clear `localhost` cookies. |
