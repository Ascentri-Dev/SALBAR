# SALBAR Resident Mobile Application: UI Specification, Architecture & Technical Plan

## 1. Overview & Mission Context

This document specifies the screen architecture, styling and design system, features, functional requirements, and non-functional requirements for the **SALBAR Resident-Facing Android Application** (`apps/mobile`).

Engineered for barangays and Geographically Isolated and Disadvantaged Areas (GIDAs) in the Philippines, the application enables residents to submit emergency incident reports both when commercial internet is available and during complete telecommunications blackouts via an **offline-first** storage engine and **Bluetooth Low Energy (BLE)** opportunistic relay to nearby TTGO T-Beam response-team terminals.

### Target Platform & Stack
- **Operating System**: Android-only (Android 10 / API 29 through Android 15 / API 35), as defined in `docs/manuscripts/Chap1.pdf` (Section 1.3 Limitations).
- **Framework**: React Native + **Expo SDK 58** (`expo@58.0.26`) with **TypeScript**.
- **Shared Contracts**: Reuses `IncidentPayload`, urgency enums, and category unions from `packages/protocol/index.ts` (`@salbar/protocol`) and mirrors the binary layout in `firmware/shared/include/salbar_protocol.h`.
- **Persistence**: `expo-sqlite` (local-first SQLite database).
- **Sensors & Connectivity**: `expo-location` (GNSS/GPS), `expo-network` (reachability), `expo-crypto` (UUID v4 generation), and `react-native-ble-plx` (BLE Central GATT client).

---

## 2. Screen Architecture

The application consolidates resident emergency workflows into a persistent **Ambient Status Header** and **three primary bottom-tab views** optimized for one-handed crisis use.

```text
+-------------------------------------------------------+
| SALBAR RESIDENT   [GPS: Locked +/-4m]  [Mode: Offline] |
+-------------------------------------------------------+
|                                                       |
|   Active Screen Content                               |
|   (1. Report Emergency | 2. Outbox & Sync | 3. Guide) |
|                                                       |
+-------------------+-------------------+---------------+
|  1. Report        |  2. Outbox (2)    |  3. Guide     |
+-------------------+-------------------+---------------+
```

### Ambient Status Header (Persistent Top Bar)
Always visible across all tabs so the resident immediately knows hardware and network readiness:
- **App Identity**: `SALBAR RESIDENT` badge with safety-orange indicator.
- **GNSS / GPS Pill**:
  - `GPS: +/-4m` (Cyan `#06B6D4`) when a live fix is acquired.
  - `GPS: SEARCHING` (Amber `#F59E0B`) while acquiring satellites.
  - `GPS: LAST KNOWN` or `NO FIX` (Red `#EF4444`) if location permission is denied or signal is blocked.
- **Pathway Mode Pill**:
  - `CLOUD READY` (Green `#10B981`) when internet connectivity to Cloud Relay is detected.
  - `OFFLINE: BLE` (Cyan `#06B6D4`) when internet is unavailable and Bluetooth is enabled.
  - `BT OFF` (Red `#EF4444`) when offline and Bluetooth is disabled (tapping prompts to enable Bluetooth).
- **Theme Toggle Button**: Quick icon button allowing manual override between **Dark Mode** and **Light Mode** (defaults to the Android system theme via `useColorScheme()`).

---

### Screen 1: Report Emergency (Primary Triage View)
Designed so a panicked resident can file a location-tagged emergency report in **3 taps or fewer**.

1. **Quick-Tap Emergency Category Grid (2 columns x 3 rows)**:
   Each card has a minimum height of `88 dp`, high-contrast border, icon, and bilingual label. Mapped strictly to `SalbarCategory`:
   - `trapped-persons` — **Trapped Persons** (*Naa'y Natabunan / Na-trap*)
   - `medical-emergency` — **Medical Emergency** (*Emerhensya Medikal*)
   - `flood-inundation` — **Flood Inundation** (*Baha / Pagtaas sa Tubig*)
   - `structural-collapse` — **Structural Damage** (*Guba nga Balay / Gusali*)
   - `landslide-hazard` — **Landslide Hazard** (*Dahili sa Yuta*)
   - `relief-supplies` — **Relief Supplies** (*Kinahanglan og Pagkaon / Tubig*)

2. **Urgency Selector (4-Pill Horizontal Row)**:
   Mapped to `SalbarUrgency`:
   - `CRITICAL` (`#EF4444`) — Immediate life threat
   - `HIGH` (`#F97316`) — Severe hazard / rapid escalation
   - `MODERATE` (`#F59E0B`) — Damage / blocked access
   - `LOW` (`#0284C7`) — Supply inquiry / minor report
   - *Default*: `HIGH` (or `CRITICAL` automatically pre-selected when `trapped-persons` or `medical-emergency` is tapped, overridable by user).

3. **Affected / Victim Count Stepper**:
   - Compact `[-]` `1` `[+]` numeric stepper (`0` to `99`), matching `SalbarIncidentPayload.victim_count`.

4. **Multilingual Free-Form Description Input**:
   - Multi-line text input accepting **Cebuano, Tagalog, English, or code-switched text** (e.g., *"Naay natabunan sa Sitio Riverside, tabang!"*).
   - Enforces the `128`-byte UTF-8 constraint of `SalbarIncidentPayload.raw_text[128]` with a live monospace byte counter (`42 / 128 bytes`) so BLE-LoRa compaction never unexpectedly drops critical details.

5. **Primary Submit CTA (`SAVE & SEND REPORT`)**:
   - Full-width high-visibility Safety Orange (`#FF6B00` dark / `#EA580C` light) button (`56 dp` height).
   - **Offline-First Guarantee**: Tapping submit immediately writes the record to local SQLite first (`< 50 ms`), triggers haptic confirmation, clears the form, and dispatches asynchronously to the Dual-Path Sync Engine.

---

### Screen 2: Outbox & Sync (Queue & BLE Relay Monitor)
Provides transparency on saved reports and manages opportunistic BLE transfers to nearby TTGO T-Beam terminals.

1. **Queue Summary Strip (3 KPI Pills)**:
   - `Pending` (Amber) | `Relayed (BLE)` (Cyan) | `Delivered (Cloud)` (Green)

2. **Nearby Responder Terminals Card (BLE Central Scanner)**:
   - Displays Bluetooth adapter status and active scan state (`Scanning for SAR terminals...` / `Idle`).
   - Lists discovered TTGO T-Beam peripherals (`SAR-01`, `DA-02`, `RL-03`) advertising `SALBAR_BLE_SERVICE_UUID`, along with live **RSSI (dBm)** signal strength indicator.
   - Manual **`Scan & Sync Now`** button to trigger an immediate foreground BLE scan + transfer cycle when a responder is nearby.

3. **Queued Report Feed**:
   - Chronological list of local reports (most recent first), each showing:
     - Short UUID reference (e.g., `RES-8F2A`) & `incidentIdNum`
     - Category & Urgency badge
     - Timestamp (tabular monospace) & captured GPS coordinates (`10.31570, 123.88540`)
     - Sync Status Chip:
       - `PENDING LOCAL` (Amber) — Stored safely on phone; awaiting internet or BLE terminal
       - `SYNCING BLE...` (Cyan) — Writing GATT payload to nearby T-Beam
       - `RELAYED VIA BLE` (Cyan/Green) — Accepted & ACKed by T-Beam for LoRa mesh forwarding
       - `SENT VIA CLOUD` (Green) — Confirmed received by `apps/cloud-relay`
   - Tapping a card opens a **Report Detail Modal** with full text, error log (if any), manual **Retry Sync** button, and **Delete** option.

---

### Screen 3: Emergency Guide & Settings
Supports pre-disaster preparation, permission verification, and field testing.

1. **Permission & Hardware Readiness Checklist**:
   - Interactive status rows for:
     - Fine Location (`ACCESS_FINE_LOCATION`)
     - Bluetooth Scan & Connect (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`)
     - Battery Optimization Exemption (recommended so background/screen-on BLE relay isn't killed prematurely)
   - One-tap **`Grant / Fix`** buttons that open the system permission prompt or Android app settings.

2. **Offline Disaster Reporting Guide**:
   - Concise, illustrated instructions in **English / Cebuano / Tagalog** explaining how offline BLE relay works (keep Bluetooth ON during blackouts; move near barangay response teams with handheld T-Beam units).

3. **Configuration & Diagnostics (Developer / Thesis Trial Section)**:
   - Configurable **Cloud Relay Endpoint** (backed by `EXPO_PUBLIC_CLOUD_RELAY_URL`, editable in settings for local/staging tests).
   - **Test Mode / Force Offline Toggle**: Forces the app to bypass Cloud Relay and exercise the BLE transfer path even when Wi-Fi/cellular is active (essential for thesis defense demos).

---

## 3. Styling, Design System & Color Palette

The mobile UI directly mirrors [web-dashboard-ui-plan.md](web-dashboard-ui-plan.md) and `apps/web-dashboard/src/index.css` so the resident app and operator command center form a unified visual ecosystem.

### Theme Behavior
- **System Default**: Initializes using Android's system `Appearance.getColorScheme()` (`useColorScheme()`), allowing automatic switching between Dark Mode and Light Mode.
- **Manual Override**: Persistent header toggle lets the resident switch themes anytime (e.g., forcing Light Mode under harsh outdoor sunlight).

### Dark Mode Tokens (Midnight Navy Operations Theme)
| Token | Hex Value | Role and Usage |
| :--- | :--- | :--- |
| `bgBase` | `#0A0F1D` | Main screen background (Deep Midnight Navy) |
| `bgSurface` | `#111C38` | Category cards, report cards, bottom tab bar, modals |
| `bgSurfaceElevated` | `#18264B` | Pressed/selected cards, input backgrounds |
| `borderSubtle` | `#1F2E5C` | Card outlines, dividers, input borders |
| `borderFocus` | `#334B85` | Active input borders and selected category outline |
| `textPrimary` | `#F8FAFC` | Headings, primary labels, button text |
| `textSecondary` | `#94A3B8` | Subtitles, helper text, timestamps |
| `textMuted` | `#64748B` | Placeholders, disabled labels |
| `accentPrimary` | `#FF6B00` | Primary Submit CTA, active tab indicator, focus ring |
| `accentHover` | `#FF8533` | Pressed state for primary CTA |
| `accentSubtle` | `rgba(255, 107, 0, 0.12)` | Selected category card tint, highlight badges |

### Light Mode Tokens (High-Glare Outdoor Theme)
| Token | Hex Value | Role and Usage |
| :--- | :--- | :--- |
| `bgBase` | `#F1F5F9` | Main screen background (Cool Off-White) |
| `bgSurface` | `#FFFFFF` | Cards, tab bar, modals |
| `bgSurfaceElevated` | `#E2E8F0` | Pressed/selected secondary containers |
| `borderSubtle` | `#CBD5E1` | Card outlines, dividers |
| `borderFocus` | `#94A3B8` | Active inputs and selected card borders |
| `textPrimary` | `#0F172A` | High-contrast headings and body text |
| `textSecondary` | `#475569` | Secondary labels and timestamps |
| `textMuted` | `#94A3B8` | Placeholders and disabled text |
| `accentPrimary` | `#EA580C` | Primary Submit CTA and active controls |
| `accentHover` | `#C2410C` | Pressed state for light mode CTA |
| `accentSubtle` | `rgba(234, 88, 12, 0.10)` | Active category tint and chips |

### Shared Emergency & Status Palette (Consistent Across Both Themes)
| Functional Role | Hex Value | Usage |
| :--- | :--- | :--- |
| **Critical / Danger** | `#EF4444` | `CRITICAL` urgency badge, `BT OFF` / `NO FIX` alert |
| **High Priority** | `#F97316` | `HIGH` urgency badge, landslide/structural accents |
| **Moderate / Warning** | `#F59E0B` | `MODERATE` urgency badge, `PENDING LOCAL`, `GPS SEARCHING` |
| **Low / Informational** | `#0284C7` | `LOW` urgency badge, informational notices |
| **Operational / Success** | `#10B981` | `CLOUD READY`, `SENT VIA CLOUD`, `RELAYED VIA BLE` |
| **Radio / Telemetry** | `#06B6D4` | `OFFLINE: BLE`, `GPS LOCKED`, RSSI indicators |

### Typography & Tactile 3D Component Geometry
- **Display & Headings Font**: `Space Grotesk` (`@expo-google-fonts/space-grotesk`, weights 500, 600, 700) for screen titles, emergency card headers, modal titles, and navigation labels.
- **UI Body Font**: System Sans / `Inter` for descriptions, helper copy, and form inputs.
- **Telemetry / Data Font**: `JetBrains Mono` (`@expo-google-fonts/jetbrains-mono`, weights 400, 500, 700) with tabular numbers (`fontVariant: ['tabular-nums']`) for coordinates, byte counts, RSSI dBm, and timestamps.
- **Tactile 3D Border & Extrusion System**:
  - Preserves SALBAR's rounded geometry (`24px` cards, `18px` controls, `9999px` pills) and Midnight Navy / Light palette while adding crisp `2px` borders and a hard-offset `3px–4px` 3D backing layer.
  - **Mechanical Press Physics**: Interactive tiles, cards, and pill CTAs physically depress (`translateX: +3px, translateY: +3px`) onto their 3D backing layer on press (`onPressIn` / `onPressOut` spring).
  - **Subtle Container Motion**: Staggered `reveal-up` entrance (`translateY: 14px -> 0`, `opacity: 0 -> 1`) on list cards and stage transitions.

---

## 4. Technical Architecture & Data Flow

```text
+-------------------------------------------------------------------+
|                   SALBAR MOBILE SYNC PIPELINE                     |
+-------------------------------------------------------------------+

  [ Resident Submits Report ]
              |
              v
  [ 1. Write to Local SQLite ]  (Guaranteed < 50ms, status = PENDING_LOCAL)
              |
              v
  { Internet Reachable & !forceOffline? }
         |                        |
        YES                       NO
         |                        |
         v                        v
  [ 2A. Cloud Relay ]      [ 2B. BLE Central Scanner ]
  POST /api/v1/incidents   Scan for SALBAR_BLE_SERVICE_UUID
  (EXPO_PUBLIC_CLOUD_      (TTGO T-Beam Peripheral: SAR-*)
   RELAY_URL)                     |
         |                        v
         |                 Connect -> Request MTU 256 -> Write GATT
         |                 Wait for ACK Notification
         |                        |
         v                        v
  [ Mark SENT_CLOUD ]      [ Mark RELAYED_BLE ]
         |                        |
         +----------> + <---------+
                      |
                      v
        [ Coordination Backend Deduplicates by reportId ]
```

### A. Offline-First SQLite Schema (`reports`)
Stored locally via `expo-sqlite`:

```sql
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY NOT NULL,          -- UUID v4 (deduplication key)
  incident_id_num INTEGER NOT NULL,      -- 16-bit numeric ID (1..65535) for LoRa frame
  category TEXT NOT NULL,                -- SalbarCategory union string
  urgency TEXT NOT NULL,                 -- 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  victim_count INTEGER NOT NULL DEFAULT 1,
  raw_text TEXT NOT NULL,                -- Max 128 UTF-8 bytes
  lat REAL NOT NULL DEFAULT 0.0,         -- WGS84 latitude (0.0 if no fix)
  lng REAL NOT NULL DEFAULT 0.0,         -- WGS84 longitude (0.0 if no fix)
  accuracy_m REAL NOT NULL DEFAULT 0.0,  -- Horizontal accuracy in meters
  pos_age_s INTEGER NOT NULL DEFAULT 65535, -- 0 = live fix, >0 = stale, 65535 = none
  created_at_utc INTEGER NOT NULL,       -- Unix epoch ms
  sync_status TEXT NOT NULL,             -- 'PENDING_LOCAL' | 'SYNCING' | 'SENT_CLOUD' | 'RELAYED_BLE'
  sync_path TEXT,                        -- 'CLOUD_RELAY' | 'LORA_MESH_BLE' | NULL
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
```

### B. Cloud Relay HTTP Contract
- **Base URL**: Configured via `EXPO_PUBLIC_CLOUD_RELAY_URL` (with runtime override in Screen 3 settings for testing).
- **Endpoint**: `POST ${CLOUD_RELAY_URL}/api/v1/incidents`
- **Request Body** (JSON aligning with `IncidentPayload` in `packages/protocol/index.ts`):
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "incidentIdNum": 4821,
    "urgency": "CRITICAL",
    "category": "trapped-persons",
    "source": "CLOUD_RELAY",
    "victimCount": 3,
    "lat": 10.3157,
    "lng": 123.8854,
    "accuracyMeters": 4.2,
    "createdAtUtc": 1795590000000,
    "rawText": "Naay natabunan sa Sitio Riverside, tabang!"
  }
  ```
- **Idempotency**: HTTP `200`, `201`, or `409` (already recorded) transitions `sync_status` to `SENT_CLOUD`.

### C. BLE GATT Specification (Phone Central <-> TTGO T-Beam Peripheral)
Matches the ESP32 NimBLE/Bluedroid peripheral to be implemented on `firmware/field-terminal`:

- **Advertised Local Name Prefix**: `SALBAR-` (e.g., `SALBAR-SAR01`)
- **Primary Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e` (SALBAR Incident Ingestion Service)
- **Incident Write Characteristic UUID**: `6e400002-b5a3-f393-e0a9-e50e24dcca9e` (`WRITE` / `WRITE_NO_RESPONSE`)
- **ACK Notify Characteristic UUID**: `6e400003-b5a3-f393-e0a9-e50e24dcca9e` (`NOTIFY`)
- **MTU & Framing**:
  - Request `MTU = 256` upon connection.
  - Payload serialized as a compact binary frame matching `SalbarIncidentPayload` + `salbar_crc16()` (`<= 146` bytes total), setting `source = SALBAR_SRC_LORA_MESH_BLE (1)`, so the T-Beam can validate the CRC16 and queue the frame directly onto the LoRa mesh with zero string-parsing overhead.
  - Wait up to `5000 ms` for a 4-byte ACK notification (`[incident_id_num_lo, incident_id_num_hi, status_code, 0x00]`) before marking `RELAYED_BLE`.
  - If MTU negotiation returns `< 150` bytes on an older Android device, fall back to 20-byte chunked writes with a 2-byte sequence prefix.

---

## 5. Functional Requirements

| ID | Requirement | Verification Criteria |
| :--- | :--- | :--- |
| **FR-1** | **Quick-Tap Triage Submission** | Resident can select one of 6 categories, choose urgency, adjust victim count, enter multilingual text (<= 128 UTF-8 bytes), and submit. |
| **FR-2** | **Automatic GPS Tagging** | App captures live `expo-location` coordinates (`lat`, `lng`, `accuracy_m`); if indoors/no fix, records last-known fix with `pos_age_s` or `(0, 0)` with `65535` so submission is never blocked. |
| **FR-3** | **Offline-First Local Persistence** | Every submitted report is committed to SQLite immediately and survives app termination and device reboot. |
| **FR-4** | **Dual-Path Routing** | When internet is available (and Force Offline is off), syncs to Cloud Relay; when offline, queues for BLE Central transfer. |
| **FR-5** | **BLE Terminal Discovery & Relay** | App scans for `SALBAR-*` T-Beam peripherals, connects over GATT, negotiates MTU, transmits binary incident frame with CRC16, and awaits ACK notification. |
| **FR-6** | **Duplicate Prevention** | Each report generates an immutable UUID v4 and 16-bit `incident_id_num` used by both Cloud Relay and BLE paths so the backend deduplicates identical reports. |
| **FR-7** | **Sync Status & Manual Retry** | Outbox screen displays real-time delivery status per report and allows manual scan/retry triggers. |
| **FR-8** | **System Theme + Manual Toggle** | App follows system Light/Dark preference on launch and provides a persistent header toggle. |

---

## 6. Non-Functional Requirements

| ID | Category | Target / Constraint |
| :--- | :--- | :--- |
| **NFR-1** | **Zero Data Loss & Write Latency** | Local SQLite insert completes in `< 50 ms` before any network/BLE I/O begins. |
| **NFR-2** | **Crisis Usability** | Minimum `48x48 dp` touch targets (`>= 88 dp` for category tiles); WCAG AA+ contrast in both Dark and Light palettes; <= 3 taps to submit an emergency. |
| **NFR-3** | **Battery & Radio Efficiency** | BLE scanning uses duty cycling (e.g., 5s active scan / 15s idle backoff) and stops completely when the `PENDING_LOCAL` outbox count is `0`. |
| **NFR-4** | **LoRa-Compatible Payload Size** | Compacted incident payload remains `<= 180 bytes` total (including 128-byte `raw_text` cap) to ensure reliable single-packet SF9 LoRa transmission after T-Beam ingestion. |
| **NFR-5** | **Android Permissions & OS Support** | Clean runtime permission flow for Android 10–15 (`ACCESS_FINE_LOCATION`, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`) without requiring legacy storage permissions. |
| **NFR-6** | **Build Reproducibility** | Configured with Expo SDK 58 + `eas.json` (`preview` profile producing standalone `.apk` builds) so any team Android device can install and test offline. |

---

## 7. Implementation Roadmap (Next Steps in `apps/mobile`)

1. **Phase 1 — Scaffold**: Initialize Expo SDK 58 + TypeScript in `apps/mobile`, configure `app.json` Android permissions and `eas.json`, and link `@salbar/protocol`.
2. **Phase 2 — Core Data & Theme**: Implement `ThemeContext` (system default + toggle), SQLite repository (`reports` table), and `expo-location` / `expo-network` hooks.
3. **Phase 3 — UI Screens**: Build Screen 1 (Report Emergency), Screen 2 (Outbox & Sync), Screen 3 (Guide & Settings), and Ambient Status Header.
4. **Phase 4 — Sync & BLE**: Implement Cloud Relay HTTP client and `react-native-ble-plx` GATT Central client + binary CRC16 serializer matching `salbar_protocol.h`.
5. **Phase 5 — Build & Field Trials**: Generate Android `.apk` via EAS Build and validate end-to-end BLE transfer against `firmware/field-terminal` (Strategy 5 in `docs/manuscripts/Chap2.pdf`).
