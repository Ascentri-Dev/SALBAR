# SALBAR Common Data Protocol (`packages/protocol`)

## Overview
Shared data transfer schemas, packet definitions, and serialization contracts unifying all software, mobile, and embedded components of SALBAR.

## Contracts
- **Incident Schema**: Universal JSON/Protobuf schema representing emergency reports across the Android app, Cloud Relay, Backend, and Web Dashboard.
- **BLE GATT Specification**: Service and Characteristic UUID definitions, MTU sizes, and byte packing layout for opportunistic phone-to-terminal transfer.
- **LoRa Binary Payload Spec**: Bit-field definitions and packing logic ensuring LoRa frames fit within single-packet transmission limits under high spreading factors (SF 7–12).
