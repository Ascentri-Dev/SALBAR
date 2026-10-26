# Cloud Relay Service (`apps/cloud-relay`)

## Overview
A lightweight cloud endpoint that receives disaster reports directly from resident mobile devices whenever internet connectivity remains intact.

## Core Features
- **Public Ingestion API**: Secure, minimal-footprint HTTPS webhook endpoint accepting queued incident payloads from mobile devices.
- **De-duplication & Caching**: Temporary message buffer maintaining report IDs and hashes to ensure reports received via both cloud and LoRa paths are safely de-duplicated at the backend.
- **Backend Bridge**: Provides a synchronization queue from which the host computer and coordination backend pull internet-submitted reports.
