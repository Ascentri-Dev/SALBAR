#!/usr/bin/env python3
"""
SALBAR Gateway Test Command CLI
Sends commands to the SALBAR Gateway via the WebSocket bridge.
Usage:
  python services/serial-bridge/send_cmd.py PING
  python services/serial-bridge/send_cmd.py TELEMETRY
  python services/serial-bridge/send_cmd.py INCIDENT
  python services/serial-bridge/send_cmd.py DISPATCH
"""

import sys
import json
import asyncio
import websockets

COMMANDS = {
    "PING": {"cmd": "PING"},
    "TELEMETRY": {"cmd": "SIMULATE_TELEMETRY", "nodeId": "SAR-01", "lat": 10.3142, "lng": 123.8875},
    "INCIDENT": {
        "cmd": "SIMULATE_INCIDENT",
        "id": "INC-2026-099",
        "urgency": "CRITICAL",
        "category": "trapped-persons",
        "victims": 3,
        "lat": 10.3185,
        "lng": 123.8835,
        "rawText": "Dali! Naay natabunan nga balay sa Sitio Riverside! (Help! House buried at Sitio Riverside!)"
    },
    "DISPATCH": {
        "cmd": "DISPATCH",
        "targetUnit": "SAR-01",
        "incidentIdNum": 99,
        "actionCode": 0,
        "notes": "Proceed to Sitio Riverside search site"
    }
}

async def send_command(cmd_name: str):
    cmd_name = cmd_name.upper()
    payload = COMMANDS.get(cmd_name)
    if not payload:
        print(f"Unknown command: '{cmd_name}'. Available: {list(COMMANDS.keys())}")
        return

    uri = "ws://localhost:8080"
    print(f"Connecting to Gateway Bridge at {uri}...")
    try:
        async with websockets.connect(uri) as ws:
            # Receive initial status
            init_status = await ws.recv()
            print(f"<- Gateway Status: {init_status}")

            print(f"-> Sending command: {json.dumps(payload)}")
            await ws.send(json.dumps(payload))

            # Wait briefly for response / broadcast
            try:
                while True:
                    reply = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    data = json.loads(reply)
                    print(f"<- Received: {reply}")
                    # If this was a simulated event or pong, we are done
                    if data.get("type") in ["INCIDENT", "TELEMETRY"] or data.get("status") in ["PONG", "DISPATCH_SENT", "DISPATCH_FAILED"]:
                        break
            except asyncio.TimeoutError:
                pass

    except Exception as ex:
        print(f"Error connecting to bridge: {ex}")

if __name__ == "__main__":
    target_cmd = sys.argv[1] if len(sys.argv) > 1 else "PING"
    asyncio.run(send_command(target_cmd))
