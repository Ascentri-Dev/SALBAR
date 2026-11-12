# Central Coordination Backend (`services/backend`)

## Overview
The central service orchestrating data ingestion, report de-duplication, state management, and communication across the SALBAR platform.

## Responsibilities
- **Multi-Source Ingestion**: Ingests incident telemetry received via the gateway serial link (LoRa mesh) and the cloud relay service.
- **De-Duplication Engine**: Filters out redundant packets matching existing report UUIDs originating from dual-path submissions.
- **Pipeline Orchestration**:
  1. Sends incoming raw text to `services/nlp-classifier` for translation and severity scoring.
  2. Forwards classified incidents and responder states to `services/dispatcher-engine` for OR-Tools allocation.
  3. Invokes the constrained propose-only AI agent to generate human-readable situation briefings.
  4. Delivers pending proposals to `apps/web-dashboard` and awaits human authorization.
- **Dispatch Queue**: Emits approved dispatch instructions to `services/serial-bridge` for transmission over the LoRa mesh network.
