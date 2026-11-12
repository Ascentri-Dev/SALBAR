# SALBAR: System for Allocation and LoRa-Linked Barangay Assessment and Response

[![Branch](https://img.shields.io/badge/branch-main-blue.svg)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#)
[![Platform](https://img.shields.io/badge/platform-ESP32%20%7C%20Android%20%7C%20Web%20%7C%20FastAPI-orange.svg)](#)

> **SALBAR** is an integrated hardware, firmware, and software disaster response coordination system engineered to sustain emergency reporting and responder dispatch during complete commercial telecommunications and internet outages. Designed for Philippine barangays and Geographically Isolated and Disadvantaged Areas (GIDAs).

---

## System Architecture Overview

SALBAR bridges the critical post-disaster communication gap using a multi-tier, infrastructure-independent architecture:

```
[ Resident Mobile App ]
    │ (Internet Available)
    ├──► [ Cloud Relay Service ] ─────────────────────────────────────────────┐
    │                                                                         │
    │ (No Internet / Blackout)                                                ▼
    └──► (BLE Transfer) ──► [ Handheld Field Terminal (T-Beam) ]              │
                                  │                                           │
                                  ▼ (LoRa Mesh / Store-and-Forward)           │
                            [ Intermediate Relay Node(s) ]                    │
                                  │                                           │
                                  ▼                                           │
                            [ Gateway Base Station (LoRa32) ]                 │
                                  │ (Serial Connection)                       │
                                  ▼                                           ▼
                      [ Coordination Host / Backend Engine ] ◄────────────────┘
                         ├─ Multilingual Transformer NLP (EN / TL / CEB)
                         ├─ Google OR-Tools Allocation Solver (Fatigue & Road Uncertainty)
                         └─ Constrained Propose-Only AI Agent
                                  │
                                  ▼
                      [ Operator Web Dashboard (HITL) ]
                         └─ Human Decision (Approve / Reject) ──► LoRa Dispatch to Terminals
```

---

## Proposed Monorepo Structure

```text
SALBAR/
├── apps/
│   ├── mobile/             # Resident-facing Android application (Offline-first, BLE + Cloud relay)
│   ├── web-dashboard/      # Operator emergency command center & HITL dispatch interface
│   └── cloud-relay/        # Lightweight cloud endpoint receiving direct resident internet reports
│
├── services/
│   ├── backend/            # Central coordination backend API (FastAPI / Node.js)
│   ├── dispatcher-engine/  # Google OR-Tools solver (stochastic routing, fatigue modeling)
│   ├── nlp-classifier/     # Multilingual Transformer model service (EN / TL / CEB / code-switching)
│   └── serial-bridge/      # Gateway serial communication daemon (Host <-> LoRa Gateway)
│
├── firmware/
│   ├── field-terminal/     # ESP32 TTGO T-Beam firmware (LoRa mesh, GPS Kalman filter, BLE, OLED, keypad)
│   ├── gateway/            # LilyGO TTGO LoRa32 gateway firmware (LoRa mesh receiver & serial forwarder)
│   └── shared/             # Common packet formats, binary serialization, and protocol definitions
│
├── packages/
│   ├── protocol/           # Shared packet schemas & protobuf/struct definitions
│   └── config/             # Shared linting, TypeScript, and styling configurations
│
├── docs/                   # Thesis documentation, research papers, circuit diagrams, and specifications
└── tools/                  # Hardware testing scripts, mesh simulators, synthetic dataset generators
```

---

## Key Subsystems

1. **Firmware & Field Terminals (`/firmware`)**
   - **Hardware**: LilyGO TTGO T-Beam V1.2 (ESP32, LoRa 915 MHz, GNSS/GPS) + LilyGO TTGO LoRa32 V2.1.
   - **LoRa Mesh Network**: Decentralized store-and-forward mesh protocol resilient to network partitions.
   - **GPS Kalman Filter**: Edge-computed recursive predict-correct filtering to suppress multipath drift.
   - **BLE Ingestion**: Opportunistic synchronization receiving emergency reports from civilian Android devices.

2. **Resident Android Application (`/apps/mobile`)**
   - **Offline-First Storage**: Local database persisting incident submissions, timestamps, and GPS fixes.
   - **Dual-Path Sync**: Direct HTTPS transmission via Cloud Relay when internet is accessible; automatic BLE advertisement/transfer to field terminals during outages.

3. **Coordination Backend & Intelligence Layer (`/services`)**
   - **Multilingual NLP**: Transformer-based classifier trained on disaster data across English, Tagalog, Cebuano, and code-switched dialect.
   - **OR-Tools Dispatch Engine**: Constraint Programming formulation incorporating responder fatigue degradation and road condition uncertainties.
   - **Human-in-the-Loop (HITL) Agent**: Propose-only AI generating situation briefings; strictly prohibits autonomous dispatches without human operator sign-off.

4. **Operator Command Dashboard (`/apps/web-dashboard`)**
   - Real-time GIS map displaying incident pins, responder locations, and triage priority.
   - Proposal review modal for executing or overriding dispatch commands routed via LoRa.

---

## Branching Strategy

- `main` — Production-grade, peer-reviewed releases and final thesis defense deliverables.
- `develop` — Active integration branch for all monorepo subsystems.
- `feature/*` — Feature-specific branches (e.g. `feature/mesh-routing`, `feature/kalman-filter`, `feature/or-tools-solver`).
- `fix/*` — Bug and hardware-integration fixes.

---

## Authors & Academic Affiliation

- **John Michael A. Nave**
- **John Peter D. Pestaño**
- **Jesnar T. Tindogan**
- **Engr. Stephanie Grace V. Cortes** (Adviser)

*Cebu Institute of Technology – University (CIT-U)*  
*Department of Computer Engineering*
