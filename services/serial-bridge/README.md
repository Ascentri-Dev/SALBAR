# LoRa Gateway Serial Bridge Daemon (`services/serial-bridge`)

## Overview
A background service running on the host coordination computer that interfaces directly with the central LoRa gateway unit over a USB-to-UART serial connection.

## Responsibilities
- **Serial Stream Processing**: Reads JSON-formatted telemetry and emergency incident packets emitted by the LilyGO T3S3 gateway unit over native USB CDC Serial.
- **WebSocket Streaming**: Exposes `ws://localhost:8080` broadcasting live packet events to the Operator Web Dashboard.
- **Downlink Framing**: Serializes human-approved dispatch commands from the web dashboard and writes them over serial to the gateway for over-the-air LoRa downlink.
- **Automatic Port Recovery**: Automatically scans for connected ESP32-S3 devices, handles disconnections, and supports `--mock` simulation mode.

## Installation & Running

1. **Install dependencies**:
   ```bash
   cd services/serial-bridge
   pip install -r requirements.txt
   ```

2. **Run bridge daemon (Auto-detect port)**:
   ```bash
   python bridge.py
   ```

3. **Specify explicit COM port**:
   ```bash
   python bridge.py --port COM3
   ```

4. **Run in Mock Simulation mode (when hardware is disconnected)**:
   ```bash
   python bridge.py --mock
   ```
