# SALBAR Project Documentation (`docs`)

## Overview
This directory houses the academic manuscripts, technical specifications, hardware configuration manuals, and testing procedures for the **SALBAR** (System for Allocation and LoRa-Linked Barangay Assessment and Response) thesis project.

---

## Directory Index

### 1. System & Hardware Guides
- **[`increment-1-guide.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/docs/increment-1-guide.md)**: Comprehensive, unified technical reference and quickstart guide for Increment 1. Covers LILYGO T3-S3 SX1262 Gateway setup, TTGO T-Beam V1.2 SX1276 Field Terminal setup, 4-button menu navigation, Python Serial Bridge daemon, multi-terminal port assignment (`COM5`/`COM6`), and end-to-end verification milestones.
- **[`commands-cheatsheet.md`](commands-cheatsheet.md)**: Quick reference for the terminal commands used day to day: running the bridge, dashboard, and T-Beam serial monitor, flashing both boards, T-Beam keys, GPS status meanings, and common fixes.
- **[`web-dashboard-ui-plan.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/docs/web-dashboard-ui-plan.md)**: User interface specification, 3-view screen architecture (Command Map CAD, Responder Fleet Management, Incident Archive), design tokens, and high-contrast light/dark emergency dispatch color palette.

### 2. Academic Manuscripts & Evaluation
- **`Chap1.pdf`**: Chapter 1 — Introduction, Problem Background, Research Objectives, Scope and Limitations, Theoretical Background, and Review of Related Literature.
- **`Chap2.pdf`**: Chapter 2 — Research Methodology, Architectural Block Diagrams, Materials and Specifications, Gantt Chart, System Flowcharts, and Experimental Testing Strategies.
- **`Approval-Sheet.pdf`**: Formal Institutional Thesis Approval Sheet (Cebu Institute of Technology – University, Department of Computer Engineering).

---

## Subsystem Documentation References

For component-level implementation details and development scripts, refer to the respective subsystem guides:

- **Firmware Subsystems**:
  - Base Station LoRa Gateway: [`firmware/gateway/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/firmware/gateway/README.md)
  - Handheld Field Terminal: [`firmware/field-terminal/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/firmware/field-terminal/README.md)
  - Common Radio Protocol & Binary Structs: [`firmware/shared/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/firmware/shared/README.md)
- **Host & Cloud Services**:
  - LoRa Gateway Serial Bridge Daemon: [`services/serial-bridge/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/services/serial-bridge/README.md)
  - Coordination Backend Engine: [`services/backend/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/services/backend/README.md)
  - Google OR-Tools Dispatcher: [`services/dispatcher-engine/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/services/dispatcher-engine/README.md)
  - Multilingual NLP Classifier: [`services/nlp-classifier/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/services/nlp-classifier/README.md)
- **Frontend Applications**:
  - Operator CAD Web Dashboard: [`apps/web-dashboard/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/apps/web-dashboard/README.md)
  - Resident Offline Mobile Application: [`apps/mobile/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/apps/mobile/README.md)
  - Public Cloud Relay: [`apps/cloud-relay/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/apps/cloud-relay/README.md)
- **Packages & Tooling**:
  - Universal Protocol Schemas: [`packages/protocol/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/packages/protocol/README.md)
  - Monorepo Linting & Config: [`packages/config/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/packages/config/README.md)
  - Evaluation & Benchmarking Tools: [`tools/README.md`](file:///c:/Users/JM/Documents/Programming/Thesis/SALBAR/tools/README.md)
