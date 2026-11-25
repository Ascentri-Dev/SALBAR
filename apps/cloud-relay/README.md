# Cloud Relay Service (`apps/cloud-relay`)

## Overview
A lightweight cloud endpoint that receives disaster reports directly from resident mobile devices whenever internet connectivity remains intact.

## Core Features
- **Public Ingestion API**: `POST /api/v1/incidents` endpoint accepting queued incident payloads from `apps/mobile`.
- **De-duplication & Caching**: In-memory UUID buffer returning `409 Conflict` for duplicate submissions across dual-path relays.
- **Live Bridge Forwarding**: Forwards accepted `INCIDENT` payloads to `services/serial-bridge` (`ws://localhost:8080`) for real-time display on `apps/web-dashboard`.

## Running Locally

```powershell
python apps/cloud-relay/server.py
```

Listens on `http://0.0.0.0:8000` by default. Set `EXPO_PUBLIC_CLOUD_RELAY_URL` (or edit the URL in the mobile app's **Guide & Settings** tab) to `http://<YOUR_PC_LOCAL_IP>:8000` so your phone on the same Wi-Fi can reach it.
