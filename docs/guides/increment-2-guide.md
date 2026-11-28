# SALBAR Increment 2: Mobile App & Cloud Relay Testing Guide

## 1. Overview and Current Scope

This guide covers end-to-end setup and verification for **Increment 2** of the SALBAR platform: connecting the **Resident Mobile App** (`apps/mobile`) through the **Cloud Relay** (`apps/cloud-relay`) and **Serial Bridge** (`services/serial-bridge`) to the **Operator Web Dashboard** (`apps/web-dashboard`).

### What Is Ready in This Stage
- **Resident Mobile App (`apps/mobile`)**: Expo SDK 58 Android client with offline-first SQLite storage (`salbar_resident.db`), 3-stage emergency triage wizard (`Type -> Urgency -> Notes`), live GPS capture, and Outbox queue management.
- **Cloud Relay Service (`apps/cloud-relay/server.py`)**: HTTP ingestion server (`0.0.0.0:8000`) accepting `POST /api/v1/incidents`, deduplicating by UUID (`409 Conflict`), and forwarding live incidents to `ws://localhost:8080`.
- **Bridge & Web Dashboard**: `services/serial-bridge/bridge.py` broadcasts Cloud Relay `INCIDENT` envelopes directly to the Operator Web Dashboard (`http://localhost:5173`).

*(Upcoming Increment 2 expansions: TTGO T-Beam BLE GATT peripheral firmware, standalone EAS `.apk` build for offline BLE relay testing, and database/NLP backend integration.)*

---

## 2. Data Flow (Internet / Wi-Fi Path)

```text
+-----------------------------------------------------------------------+
|                INCREMENT 2 LIVE CLOUD RELAY PIPELINE                  |
+-----------------------------------------------------------------------+

  [ Resident Phone (Expo Go / apps/mobile) ]
         |  1. Saves report immediately to local SQLite (PENDING_LOCAL)
         |  2. HTTP POST http://<PC_IP>:8000/api/v1/incidents
         v
  [ Cloud Relay Server (apps/cloud-relay/server.py) ]
         |  3. Deduplicates by UUID -> converts to INCIDENT envelope
         |  4. Pushes via WebSocket to ws://localhost:8080
         v
  [ Serial Bridge (services/serial-bridge/bridge.py) ]
         |  5. Broadcasts to all connected dashboard clients
         v
  [ Operator Web Dashboard (apps/web-dashboard @ localhost:5173) ]
            - Plots MOB-* incident pin on Tactical Map
            - Prepends report to Live CAD Incident Queue
```

---

## 3. Prerequisites

1. **Same Wi-Fi Network**: Your laptop/PC and Android phone must be connected to the same Wi-Fi network (hotspot or router).
2. **Expo Go Installed**: Install **Expo Go** on your Android phone from the Google Play Store.
3. **Dependencies Installed**:
   ```powershell
   # Serial Bridge & Cloud Relay Python dependencies
   pip install -r services/serial-bridge/requirements.txt

   # Web Dashboard dependencies
   npm install --prefix apps/web-dashboard

   # Mobile App dependencies
   npm install --prefix apps/mobile
   ```

### Find Your PC Local IP Address
Run `ipconfig` in PowerShell and note your Wi-Fi **IPv4 Address** (for example, `192.168.1.42`):
```powershell
ipconfig
```

---

## 4. Running the End-to-End Test (4 Terminals)

### Terminal 1: Start the Serial Bridge
Use `--mock` if the T3-S3 Gateway is not plugged in, or `--port COM5` if using hardware:
```powershell
python services/serial-bridge/bridge.py --mock
```

### Terminal 2: Start the Cloud Relay Server
```powershell
python apps/cloud-relay/server.py
```
Expected output:
```text
[INFO] Cloud Relay listening on http://0.0.0.0:8000 (forwarding to ws://localhost:8080)
```

### Terminal 3: Start the Operator Web Dashboard
```powershell
npm run dev --prefix apps/web-dashboard
```
Open **`http://localhost:5173`** in your browser.

### Terminal 4: Start the Mobile App Dev Server
```powershell
cd apps/mobile
npx expo start --clear
```
Scan the QR code in **Expo Go** on your Android phone. *(If your router blocks local Metro connections, run `npx expo start --tunnel` instead.)*

---

## 5. Verification Steps & Milestones

### Step 1: Configure the Cloud Relay URL on Your Phone
1. Open the **Guide** tab in the SALBAR Resident app.
2. Scroll to **Preferences & Field Trials**.
3. Set **Cloud Relay Base URL** to your PC's Wi-Fi IP:
   ```text
   http://<YOUR_PC_IPV4>:8000
   ```
   *(Do not use `localhost` on the phone, because `localhost` on Android points to the phone itself.)*

### Step 2: Verify Offline-First Save (Before Sending)
1. In the **Guide** tab, turn **Force Offline Mode (BLE Test)** **ON**.
2. Go to the **Report** tab, pick an emergency type (e.g., `Trapped Persons`), select `CRITICAL`, enter a note (e.g., `"Naay natabunan sa Sitio Riverside"`), and submit via **REVIEW & SEND** -> **CONFIRM & SEND**.
3. Open the **Outbox** tab:
   - **Pending** count increments to `1`.
   - The report card appears safely in your local outbox.

### Step 3: Verify Live Delivery to the Web Dashboard
1. Return to the **Guide** tab and turn **Force Offline Mode (BLE Test)** **OFF**.
2. Return to the **Outbox** tab:
   - Auto-sync triggers automatically (or tap the report card and press **Retry Sync**).
3. Observe all three terminals and the browser:
   - **Cloud Relay terminal** logs: `[CLOUD RELAY] ID=MOB-... ForwardedToBridge=True`
   - **Serial Bridge terminal** logs: `[Cloud Relay Incident] ID=MOB-...`
   - **Web Dashboard (`localhost:5173`)**: The `MOB-...` incident pin appears on the Tactical Map and prepends to the Live Incident Stream.
   - **Mobile Outbox**: The report moves from **Pending** to **Cloud Sent** (`Sent Cloud`).

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| **Mobile app times out connecting to Cloud Relay** | Using `localhost` on phone, different Wi-Fi networks, or Windows Firewall blocking port `8000`. | Verify phone and PC are on the same Wi-Fi, use `http://<PC_IPv4>:8000`, and allow Python / TCP port `8000` through Windows Defender Firewall if prompted. |
| **Expo Go fails to load bundle (Error 500 or timeout)** | Stale Metro cache or AP isolation on router. | Restart with `npx expo start --clear` or `npx expo start --tunnel`. |
| **Cloud Relay says `ForwardedToBridge=False`** | `bridge.py` is not running on port `8080`. | Start `python services/serial-bridge/bridge.py --mock` (or `--port COM5`) before sending reports. |
