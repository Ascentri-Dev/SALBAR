# SALBAR Project Documentation (`docs`)

## Overview
This directory houses the academic manuscripts, technical guides, UI specifications, and testing procedures for the **SALBAR** (System for Allocation and LoRa-Linked Barangay Assessment and Response) thesis project.

---

## Directory Structure

### 1. System & Hardware Guides (`guides/`)
- **[`guides/increment-1-guide.md`](guides/increment-1-guide.md)**: Authoritative end-to-end technical reference, wiring manual, command cheat sheet, and verification guide for Increment 1. Covers LILYGO T3-S3 SX1262 Gateway setup, TTGO T-Beam V1.2 SX1276 Field Terminal setup, breadboard wiring (OLED + 4 buttons), PlatformIO flashing, Python Serial Bridge daemon, GPS diagnostics, and the 10-trial field test.

### 2. Design & UI Specifications (`specs/`)
- **[`specs/web-dashboard-ui-plan.md`](specs/web-dashboard-ui-plan.md)**: User interface specification, 3-view screen architecture (Command Map CAD, Responder Fleet Management, Incident Archive), design tokens, and high-contrast light/dark emergency dispatch color palette.

### 3. Academic Manuscripts & Evaluation (`manuscripts/`)
- **`manuscripts/Chap1.pdf`**: Chapter 1 — Introduction, Problem Background, Research Objectives, Scope and Limitations, Theoretical Background, and Review of Related Literature.
- **`manuscripts/Chap2.pdf`**: Chapter 2 — Research Methodology, Architectural Block Diagrams, Materials and Specifications, Gantt Chart, System Flowcharts, and Experimental Testing Strategies.
- **`manuscripts/Approval-Sheet.pdf`**: Formal Institutional Thesis Approval Sheet (Cebu Institute of Technology – University, Department of Computer Engineering).

---

## Subsystem Documentation References

For component-level implementation details and development scripts, refer to the respective subsystem guides:

- **Firmware Subsystems**:
  - Base Station LoRa Gateway: [`firmware/gateway/README.md`](../firmware/gateway/README.md)
  - Handheld Field Terminal: [`firmware/field-terminal/README.md`](../firmware/field-terminal/README.md)
  - Common Radio Protocol & Binary Structs: [`firmware/shared/README.md`](../firmware/shared/README.md)
- **Host & Cloud Services**:
  - LoRa Gateway Serial Bridge Daemon: [`services/serial-bridge/README.md`](../services/serial-bridge/README.md)
  - Coordination Backend Engine: [`services/backend/README.md`](../services/backend/README.md)
  - Google OR-Tools Dispatcher: [`services/dispatcher-engine/README.md`](../services/dispatcher-engine/README.md)
  - Multilingual NLP Classifier: [`services/nlp-classifier/README.md`](../services/nlp-classifier/README.md)
- **Frontend Applications**:
  - Operator CAD Web Dashboard: [`apps/web-dashboard/README.md`](../apps/web-dashboard/README.md)
  - Resident Offline Mobile Application: [`apps/mobile/README.md`](../apps/mobile/README.md)
  - Public Cloud Relay: [`apps/cloud-relay/README.md`](../apps/cloud-relay/README.md)
- **Packages & Tooling**:
  - Universal Protocol Schemas: [`packages/protocol/README.md`](../packages/protocol/README.md)
  - Monorepo Linting & Config: [`packages/config/README.md`](../packages/config/README.md)
  - Evaluation & Benchmarking Tools: [`tools/README.md`](../tools/README.md)
