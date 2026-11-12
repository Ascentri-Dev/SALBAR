# Incident Commander Web Dashboard (`apps/web-dashboard`)

## Overview
A web-based mission control interface for barangay and city-level disaster management operators. It visualizes live incidents, responder telemetry, and provides a Human-in-the-Loop (HITL) interface for reviewing and authorizing dispatch assignments. Built with React, TypeScript, and Vite.

For the full screen architecture and color palette specification, see the [UI Plan and Design System](../../docs/web-dashboard-ui-plan.md).

## Core Features
- **Live GIS Map View**: Displays real-time location pins for incoming disaster incidents, field response teams, and road condition updates.
- **Incident Triage Queue**: Lists classified civilian and responder reports sorted by urgency and priority.
- **Human-in-the-Loop Dispatch Modal**:
  - Displays AI-generated situation briefings and Google OR-Tools recommended assignments.
  - Gives the human commander absolute decision authority to Approve, Modify, or Reject proposed responder deployments before any command is transmitted over the LoRa network.
- **Network Health Monitor**: Tracks field terminal heartbeat signals, RSSI/SNR metrics, and packet delivery rates.

## Development Scripts

Run the following commands inside `apps/web-dashboard/`:

```bash
# Start local development server
npm run dev

# Run unit and smoke tests
npm test

# Run TypeScript type check
npm run typecheck

# Run linter
npm run lint

# Build production bundle
npm run build
```
