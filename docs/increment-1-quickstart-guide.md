# SALBAR Increment 1: Hardware Setup & Execution Cheat-Sheet

A comprehensive, copy-paste reference guide for setting up, compiling, flashing, and running the **SALBAR Increment 1** system (LILYGO T3-S3 Gateway + TTGO T-Beam Field Terminal + Python Serial Bridge + Operator CAD Web Dashboard).

---

## Hardware Safety Pre-Check

> [!CAUTION]
> **Always securely thread the 915 MHz SMA antennas onto BOTH boards before plugging either into USB or battery power.** Transmitting (+20 to +22 dBm) without an antenna can permanently damage the RF power amplifiers due to reflected energy.

---

## Phase 1: Repository & Dependencies Setup

### 1. Pull Latest Code
```powershell
git pull origin feat/increment-1
```
*Pulls all the latest firmware, bridge daemon, and web dashboard updates.*

### 2. Install Python Serial Bridge Dependencies
```powershell
cd c:\Users\JM\Documents\Programming\Thesis\SALBAR\services\serial-bridge
pip install -r requirements.txt
```
*Installs `pyserial`, `websockets`, and `colorama` required for host-microcontroller bridging.*

### 3. Install Web Dashboard Frontend Dependencies
```powershell
cd c:\Users\JM\Documents\Programming\Thesis\SALBAR\apps\web-dashboard
npm install
```
*Installs React, Vite, Leaflet, and Tailwind CSS packages for the Operator CAD Dashboard.*

---

## Phase 2: Hardware Flashing

### 4. Flash the TTGO T-Beam (Field Terminal Node)
*Plug in the TTGO T-Beam via Micro-USB (with 915 MHz antenna attached).*
```powershell
cd c:\Users\JM\Documents\Programming\Thesis\SALBAR\firmware\field-terminal
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e tbeam_sx1276 --target upload
```
*Compiles and uploads the GPS Kalman filter, battery telemetry, and 915 MHz SX1276 LoRa firmware to the T-Beam.*

### 5. Flash the LILYGO T3-S3 (Gateway Base Station)
*Plug in the LILYGO T3-S3 via USB-C (with 915 MHz antenna attached).*
```powershell
cd c:\Users\JM\Documents\Programming\Thesis\SALBAR
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e t3s3_sx1262 --target upload
```
*Compiles and uploads the 915 MHz SX1262 LoRa receiver, JSON serializer, and USB CDC serial firmware to the T3-S3 Gateway.*

> [!TIP]
> **If the T3-S3 upload fails with `Could not find port`**:
> Put the T3-S3 into ROM bootloader mode:
> 1. Press and **HOLD the `BOOT` button**.
> 2. Press and release the **`RST` button** once.
> 3. Release the **`BOOT` button**.
> 4. Re-run the upload command above.

### 6. Verify Active COM Ports
```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device list
```
*Lists all currently connected USB serial devices and their assigned `COMx` port numbers.*

---

## Phase 2B: Alternative Flashing for Teammate (Zero PlatformIO Install)

If your teammate does not have PlatformIO or Python installed, they can flash the pre-compiled `.bin` files directly using Google Chrome:

1. Open **[https://espressif.github.io/esptool-js/](https://espressif.github.io/esptool-js/)** in Chrome.
2. Select Baud Rate **`115200`** or **`460800`** and click **Connect**.
3. Select the T3-S3 COM port.
4. Add the 3 binary files from `.pio\build\t3s3_sx1262\`:
   - `bootloader.bin` at Flash Address `0x0`
   - `partitions.bin` at Flash Address `0x8000`
   - `firmware.bin` at Flash Address `0x10000`
5. Click **Program**.

---

## Phase 3: Running the Live System (Open 2 Terminals)

### 7. Terminal 1: Start the Python Serial-to-WebSocket Bridge
```powershell
cd c:\Users\JM\Documents\Programming\Thesis\SALBAR\services\serial-bridge
python bridge.py
```
*Or specify the port explicitly if auto-detect picks another device:*
```powershell
python bridge.py --port COM5
```
*Connects to the T3-S3 Gateway serial stream at 115200 baud, hosts a WebSocket server at `ws://localhost:8080`, and routes live LoRa packets.*

### 8. Terminal 2: Start the Operator Web Dashboard
```powershell
cd c:\Users\JM\Documents\Programming\Thesis\SALBAR\apps\web-dashboard
npm run dev
```
*Starts the local web dev server. Open **[http://localhost:5173](http://localhost:5173)** in Google Chrome or Edge.*

---

## Phase 4: Testing & Passing Increment 1

| Milestone | Action | Expected Result |
| :--- | :--- | :--- |
| **1. Gateway Online** | Plug T3-S3 into PC & start `bridge.py` | Top header on Web Dashboard turns **ONLINE**. |
| **2. Live Telemetry** | Power on T-Beam (battery or USB) | Within 10s, `bridge.py` logs `TELEMETRY from SAR-01`. The `SAR-01` pin appears on the Leaflet Tactical Map. |
| **3. Emergency Incident** | In T-Beam serial monitor, type `INCIDENT` and press Enter | Incident appears immediately in the dashboard's **Live CAD Incident Queue**. |
| **4. HITL Dispatch Downlink** | Click incident in dashboard &rarr; click **[Approve & Dispatch via LoRa]** | Gateway transmits dispatch order over 915 MHz LoRa. T-Beam logs `[RX] DISPATCH for SAR-01` and changes status to `EN_ROUTE`. |

### Optional: Monitor T-Beam Serial Output Directly
```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device monitor -p COM6 -b 115200
```
*View live transmission logs from the T-Beam. Type `INCIDENT` and hit Enter to trigger an incident packet over the air.*

