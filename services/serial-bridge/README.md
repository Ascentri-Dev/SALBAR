# LoRa Gateway Serial Bridge Daemon (`services/serial-bridge`)

## Overview
A background service running on the host coordination computer that interfaces directly with the central LoRa gateway unit over a USB-to-UART serial connection.

## Responsibilities
- **Serial Stream Processing**: Reads binary/framed packets emitted by the LilyGO TTGO LoRa32 gateway unit.
- **Packet Validation**: Checks CRC, framing boundaries, and decodes binary payloads into structured JSON for the coordination backend.
- **Downlink Framing**: Serializes human-approved dispatch commands into binary frames and writes them to the serial port for immediate over-the-air transmission by the gateway.
- **Connection Recovery**: Auto-detects serial COM ports, handles reconnects upon hardware disconnection, and logs raw byte telemetry.
