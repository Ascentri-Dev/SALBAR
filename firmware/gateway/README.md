# Base Station LoRa Gateway Firmware (`firmware/gateway`)

## Target Hardware
- **Base Board**: LilyGO T3S3 (ESP32-S3 Dual-Core Xtensa LX7, Semtech SX1262 LoRa 915 MHz).
- **USB Interface**: Native USB Type-C (USB CDC Serial on boot).
- **Enclosure**: IP65 weatherproof ABS enclosure with 915 MHz 5–8 dBi high-gain base station antenna.
- **Connection**: USB-C data cable connected directly to the host coordination computer.

## Responsibilities
- **Mesh Root Listener**: Listens continuously on 915 MHz LoRa channels for incoming telemetry packets forwarded by field terminals.
- **Serial Forwarding**: Verifies packet checksums and forwards decoded frames via USB UART to `services/serial-bridge`.
- **Downlink Transmission**: Accepts framed dispatch commands from the host computer and broadcasts them across the LoRa mesh network targeted at designated field terminals.
- **Diagnostics Display**: Displays active mesh packet count, RSSI, and serial connection status on the onboard OLED.
