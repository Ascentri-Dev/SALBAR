# SALBAR Development Log: Gateway Base Station & End-to-End Pipeline Setup

- **Date**: October 28, 2026 (`2026-10-28`)
- **Status**: Completed & Verified
- **Scope**: LILYGO T3S3 Gateway Firmware, Common LoRa Protocol, Host Python Serial Bridge, and Web Dashboard CAD Real-Time Integration.

---

## 1. Executive Summary & Purpose

This document summarizes the technical decisions, code implementations, and operational instructions established on **October 28, 2026**. It serves as an onboarding guide for human teammates and a structured context document for future AI agents working on the SALBAR monorepo.

We have established the complete upstream hardware-to-software pipeline for the **Gateway Base Station**, allowing the system to receive telemetry/incident reports and transmit downlink dispatch orders between the physical microcontroller, host daemon, and operator web interface.

---

## 2. Hardware Specification & Roles

| Role | Selected Hardware | Key Chips & Peripherals | Status |
| :--- | :--- | :--- | :--- |
| **Gateway Base Station** | **LILYGO T3S3 SX1262 (915 MHz)** | ESP32-S3 (Xtensa Dual-Core LX7, Native USB CDC), Semtech SX1262 LoRa transceiver, IP65 enclosure, high-gain antenna | **On-hand & Configured** |
| **Field Response Terminal** | **LILYGO TTGO T-Beam V1.2 (915 MHz)** | ESP32-D0WDQ6, SX1262 LoRa transceiver, u-blox NEO-6M GNSS, AXP power management chip, OLED, 4-button triage matrix | **Awaiting Arrival** |

### RF Modulation Standard (915 MHz ISM Band)
All embedded firmware and protocol layers adhere to these RadioLib modulation settings:
* **Carrier Frequency**: `915.0 MHz`
* **Bandwidth**: `125.0 kHz`
* **Spreading Factor (SF)**: `9` (Optimized trade-off between range and Time-on-Air)
* **Coding Rate (CR)**: `7` (4/7 error tolerance)
* **Sync Word**: `0x12` (SX126X private network sync word)
* **Transmit Power**: `+22 dBm` (SX1262 maximum)
* **Preamble Length**: `8 symbols`

---

## 3. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SALBAR OVER-THE-AIR & HOST PIPELINE                    │
└─────────────────────────────────────────────────────────────────────────────────┘

 [ T-Beam Handheld Terminal ] (Field Node)
          │
          │ 915 MHz LoRa (Bit-Packed Binary Structs + CRC16)
          ▼
 [ LILYGO T3S3 Gateway ] (Base Station)
          │  - RadioLib SX1262 Non-blocking Interrupt (DIO1)
          │  - Binary Deserialization & CRC Verification
          │  - USB CDC Serial (115200 baud, JSON Lines)
          ▼
 [ services/serial-bridge ] (Python 3.13 Host Daemon)
          │  - bridge.py: Port Auto-discovery & Reconnection
          │  - Bidirectional WebSocket Server (ws://localhost:8080)
          ▼
 [ apps/web-dashboard ] (React 19 + TypeScript + Leaflet CAD)
          │  - useGatewayBridge Hook
          │  - Dynamic Map Marker Updates (Leaflet)
          │  - Real-time Incident Triage Stream
          │  - Human-in-the-Loop (HITL) Dispatch Downlink
```

---

## 4. Key Files Created & Modified

### A. Shared Protocol (`packages/protocol` & `firmware/shared`)
1. **`firmware/shared/include/salbar_protocol.h`**:
   - Universal C header defining bit-packed binary structs:
     - `SalbarHeader`: 10-byte header with magic `0x5341` ('SA'), version, message type, sequence number, source/dest node IDs.
     - `SalbarTelemetryPayload`: Latitude & Longitude in fixed-point $10^7$, accuracy in cm, battery mV, battery %, status enum, fatigue score, Kalman filter flag.
     - `SalbarIncidentPayload`: Incident ID, urgency, category, source, victim count, coordinates, raw civilian text (Cebuano/Tagalog/English).
     - `SalbarDispatchPayload`: Target unit ID, action code, destination coordinates, brief OLED notes.
   - Built-in `salbar_crc16()` CCITT routine.
2. **`packages/protocol/index.ts` & `package.json`**:
   - Matching TypeScript interfaces (`TelemetryPayload`, `IncidentPayload`, `DispatchCommand`) for frontend and backend consumption.

### B. Gateway Base Station Firmware (`firmware/gateway`)
1. **`firmware/gateway/src/pins_config.h`**:
   - Hardware pinouts for LILYGO T3S3 SX1262:
     - `LORA_NSS`: GPIO 7
     - `LORA_SCK`: GPIO 5
     - `LORA_MOSI`: GPIO 6
     - `LORA_MISO`: GPIO 3
     - `LORA_RST`: GPIO 8
     - `LORA_BUSY`: GPIO 34
     - `LORA_DIO1`: GPIO 33
     - `STATUS_LED`: GPIO 37
2. **`firmware/gateway/src/main.cpp`**:
   - Non-blocking packet reception using RadioLib and `DIO1` interrupt callbacks.
   - Deserializes binary frames and prints structured JSON lines to USB Serial.
   - Reads incoming downlink dispatch commands (`{"cmd":"DISPATCH", ...}`) from Serial and transmits them over-the-air.
   - Built-in self-test loopback commands (`PING`, `SIMULATE_TELEMETRY`, `SIMULATE_INCIDENT`).
3. **`firmware/gateway/platformio.ini` & Root `platformio.ini`**:
   - Configured for `esp32-s3-devkitc-1`.
   - Critical flag: `-D ARDUINO_USB_CDC_ON_BOOT=1` (enables direct USB Serial output on ESP32-S3 without an external USB-UART chip).
   - Root `platformio.ini` enables automatic project detection from the Antigravity IDE root.

### C. Host Python Serial Bridge (`services/serial-bridge`)
1. **`services/serial-bridge/requirements.txt`**:
   - Dependencies: `pyserial>=3.5`, `websockets>=12.0`, `colorama>=0.4.6`.
2. **`services/serial-bridge/bridge.py`**:
   - Automatically detects connected ESP32-S3 COM ports.
   - Hosts a local WebSocket server at `ws://localhost:8080`.
   - Forwards gateway serial messages to all connected web dashboard clients.
   - Relays commander dispatch authorizations from the dashboard back to the gateway serial input.
   - Provides a `--mock` mode to simulate live LoRa traffic when hardware is disconnected.

### D. Operator Web Dashboard (`apps/web-dashboard`)
1. **`apps/web-dashboard/src/hooks/useGatewayBridge.ts`**:
   - Custom React hook managing the WebSocket connection with automatic backoff reconnection.
   - Dispatches incoming `TELEMETRY` and `INCIDENT` packets to screen handlers.
   - Exposes `sendDispatch(targetUnit, incidentId, notes)` for commander orders.
2. **`apps/web-dashboard/src/screens/CommandMapScreen/CommandMapScreen.tsx`**:
   - Wired to `useGatewayBridge`:
     - Live telemetry updates responder positions, battery voltages, and fatigue scores on the Tactical Leaflet Map.
     - Live incidents prepend to the incident queue.
     - Clicking **[Approve and Dispatch via LoRa]** executes `sendDispatch()` to downlink the assignment over the air.
   - Validated: 12/12 Vitest tests pass and TypeScript check (`npm run typecheck`) compiles with zero errors.

---

## 5. How to Run, Test, and Verify the System

### Step 1: Flash the LILYGO T3S3 Gateway
1. Connect the **LILYGO T3S3** via USB-C to your computer.
2. In the Antigravity IDE:
   - Click the **`✓` (PlatformIO: Build)** button in the bottom status bar to compile.
   - Click the **`→` (PlatformIO: Upload)** button to flash the firmware.
3. Open the Serial Monitor (`115200 baud`). Upon boot, the gateway prints:
   ```json
   {"status":"GATEWAY_ONLINE","device":"LILYGO_T3S3_SX1262","freqMHz":915.0,"sf":9,"bwKHz":125.0}
   ```

### Step 2: Start the Python Serial Bridge Daemon
Open a terminal in `services/serial-bridge`:
```powershell
cd c:\SALBAR\services\serial-bridge
python bridge.py
```
*Note: If the physical T3S3 is not plugged in, run with mock simulation:*
```powershell
python bridge.py --mock
```

### Step 3: Run the Operator Web Dashboard
Open a terminal in `apps/web-dashboard`:
```powershell
cd c:\SALBAR\apps\web-dashboard
npm run dev
```
Navigate to `http://localhost:5173/`. The dashboard will automatically connect to `ws://localhost:8080`. When packets arrive, you will see real-time marker movement and incident queue updates.

---

## 6. Next Steps (Upon Arrival of TTGO T-Beam Handheld Terminal)

1. **Initialize `firmware/field-terminal`**:
   - Configure PlatformIO for TTGO T-Beam V1.2 (SX1262 + Neo-6M GNSS + AXP192/AXP2101).
   - Implement the recursive **Kalman Filter** algorithm on incoming NMEA sentences to eliminate multipath GPS jitter.
2. **Implement 4-Button Field Triage UI**:
   - Implement SSD1306 OLED interface for displaying incoming dispatch assignments and selecting triage categories.
3. **BLE Opportunistic Sync**:
   - Establish GATT service for resident Android app offloading.
4. **End-to-End Field Test**:
   - Verify range, packet delivery ratio (PDR), and time-on-air (TOA) between T-Beam field units and the T3S3 gateway base station.
