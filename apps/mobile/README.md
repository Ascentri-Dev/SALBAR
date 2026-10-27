# Resident-Facing Mobile Application (`apps/mobile`)

## Overview
An offline-first Android application designed for residents within barangays and Geographically Isolated and Disadvantaged Areas (GIDAs) to submit emergency incident reports during active crises.

## Core Features
- **Quick-Tap Triage Categories**: Fast, low-friction reporting for immediate hazards (medical, fire, flood, trapped persons, landslides).
- **Free-Form Text & Code-Switching**: Input fields allowing residents to describe emergencies in English, Tagalog, Cebuano, or mixed dialects.
- **Offline-First Storage**: Local database (e.g., Room/SQLite) that persists every report with a unique UUID, timestamp, and GPS coordinates immediately upon submission.
- **Dual-Path Transmission**:
  1. **Internet Path**: Submits directly to the Cloud Relay service whenever cellular (4G/5G) or WiFi data is reachable.
  2. **BLE Store-and-Forward Path**: During complete network collapse, searches for nearby response-team field terminals (TTGO T-Beam) and transfers queued reports opportunistically over Bluetooth Low Energy.
