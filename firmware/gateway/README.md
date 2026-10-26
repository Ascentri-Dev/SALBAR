# Base Station LoRa Gateway Firmware (`firmware/gateway`)

## Target Hardware
- **Base Board**: LilyGO TTGO LoRa32 V2.1 (ESP32, SX1276 LoRa 915 MHz, integrated OLED).
- **Enclosure**: IP65 weatherproof ABS enclosure with 915 MHz 5–8 dBi high-gain base station antenna.
- **Connection**: Shielded USB-to-UART cable connected directly to the host computer.

## Responsibilities
- **Mesh Root Listener**: Listens continuously on 915 MHz LoRa channels for incoming telemetry packets forwarded by field terminals.
- **Serial Forwarding**: Verifies packet checksums and forwards decoded frames via USB UART to `services/serial-bridge`.
- **Downlink Transmission**: Accepts framed dispatch commands from the host computer and broadcasts them across the LoRa mesh network targeted at designated field terminals.
- **Diagnostics Display**: Displays active mesh packet count, RSSI, and serial connection status on the onboard OLED.
