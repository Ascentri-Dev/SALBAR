#!/usr/bin/env python3
"""
SALBAR LoRa Gateway Serial-to-WebSocket Bridge Daemon
Bridges LILYGO T3S3 SX1262 USB CDC Serial to the SALBAR Operator Web Dashboard.

Features:
- Auto-detects connected ESP32-S3 / USB Serial COM ports.
- Reads telemetry and emergency incident JSON lines from the Gateway.
- Broadcasts real-time events to Web Dashboard clients over WebSocket (ws://localhost:8080).
- Forwards human-approved dispatch downlink commands from the Dashboard to the Gateway via Serial.
- Includes a simulation/mock mode (--mock) for standalone testing.
"""

import argparse
import asyncio
import json
import logging
import sys
import time
from typing import Set, Any

import colorama
from colorama import Fore, Style
import serial
import serial.tools.list_ports

try:
    from websockets.asyncio.server import serve, ServerConnection  # type: ignore
    from websockets.exceptions import ConnectionClosed  # type: ignore
    WebSocketType = ServerConnection
except ImportError:
    import websockets  # type: ignore
    from websockets.exceptions import ConnectionClosed  # type: ignore
    serve = websockets.serve  # type: ignore
    WebSocketType = Any

colorama.init(autoreset=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format=f"{Fore.CYAN}%(asctime)s{Style.RESET_ALL} [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("SALBAR-Bridge")

# Global connected WebSocket clients
connected_clients: Set[WebSocketType] = set()

# Global serial handle
serial_conn = None
active_port_name = None


def find_esp32_port() -> str | None:
    """Auto-detect connected USB serial port likely matching the T3S3."""
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        # ESP32-S3 native USB CDC usually shows as "USB JTAG/serial debug unit", "USB Serial Device", or "Espressif"
        if any(term in desc or term in hwid for term in ["espressif", "usb serial", "jtag", "ch34", "cp210"]):
            return p.device
    if ports:
        return ports[0].device
    return None


async def broadcast_to_clients(message: str):
    """Send JSON payload to all connected dashboard frontend clients."""
    if not connected_clients:
        return
    disconnected = set()
    for ws in connected_clients:
        try:
            await ws.send(message)
        except Exception:
            disconnected.add(ws)
    connected_clients.difference_update(disconnected)


async def serial_reader_task(port: str, baud: int):
    """Continuously read lines from the gateway serial port and broadcast."""
    global serial_conn, active_port_name
    active_port_name = port

    while True:
        try:
            logger.info(f"{Fore.YELLOW}Opening serial connection to {port} @ {baud} baud...{Style.RESET_ALL}")
            serial_conn = serial.Serial(port, baudrate=baud, timeout=1.0)
            logger.info(f"{Fore.GREEN}✓ Connected to LoRa Gateway on {port}{Style.RESET_ALL}")
            
            # Broadcast status update
            await broadcast_to_clients(json.dumps({
                "type": "GATEWAY_STATUS",
                "connected": True,
                "port": port,
                "timestamp": time.time()
            }))

            loop = asyncio.get_running_loop()

            while serial_conn and serial_conn.is_open:
                # Read line asynchronously using executor to avoid blocking the event loop
                line = await loop.run_in_executor(None, serial_conn.readline)
                if not line:
                    continue
                
                raw_str = line.decode("utf-8", errors="replace").strip()
                if not raw_str:
                    continue

                try:
                    data = json.loads(raw_str)
                    msg_type = data.get("type") or data.get("status")
                    
                    if msg_type == "TELEMETRY":
                        node = data.get("srcNode", "???")
                        rssi = data.get("rssi", 0)
                        logger.info(f"{Fore.BLUE}[LoRa Telemetry]{Style.RESET_ALL} Node={Fore.WHITE}{node}{Style.RESET_ALL} RSSI={rssi}dBm")
                    elif msg_type == "INCIDENT":
                        inc_data = data.get("data", {})
                        inc_id = inc_data.get("id", "???")
                        urgency = inc_data.get("urgency", "???")
                        logger.info(f"{Fore.RED}[LoRa Incident!]{Style.RESET_ALL} ID={inc_id} Urgency={Fore.RED}{urgency}{Style.RESET_ALL}")
                    else:
                        logger.info(f"{Fore.MAGENTA}[Gateway Msg]{Style.RESET_ALL} {raw_str}")

                    # Forward directly to web dashboard
                    await broadcast_to_clients(raw_str)

                except json.JSONDecodeError:
                    # Non-JSON debug message from ESP32
                    logger.debug(f"[RAW SERIAL] {raw_str}")

        except serial.SerialException as ex:
            logger.warning(f"{Fore.RED}Serial error on {port}: {ex}. Retrying in 3 seconds...{Style.RESET_ALL}")
            if serial_conn:
                try:
                    serial_conn.close()
                except Exception:
                    pass
                serial_conn = None

            await broadcast_to_clients(json.dumps({
                "type": "GATEWAY_STATUS",
                "connected": False,
                "port": port,
                "error": str(ex),
                "timestamp": time.time()
            }))
            await asyncio.sleep(3)
        except Exception as ex:
            logger.error(f"Unexpected serial reader error: {ex}")
            await asyncio.sleep(2)


async def mock_generator_task():
    """Generates simulated telemetry and incident stream when running in --mock mode."""
    logger.info(f"{Fore.CYAN}Starting simulation generator loop...{Style.RESET_ALL}")
    
    # Broadcast initial online status
    await broadcast_to_clients(json.dumps({
        "type": "GATEWAY_STATUS",
        "connected": True,
        "port": "MOCK_VIRTUAL_T3S3",
        "timestamp": time.time()
    }))

    seq = 100
    while True:
        await asyncio.sleep(8)
        seq += 1

        # Simulate periodic telemetry from SAR-01
        telem_msg = {
            "type": "TELEMETRY",
            "srcNode": "SAR-01",
            "rssi": -68.0,
            "snr": 9.2,
            "seq": seq,
            "data": {
                "id": "SAR-01",
                "lat": 10.3142 + (seq % 10) * 0.0001,
                "lng": 123.8875 + (seq % 10) * 0.0001,
                "accuracyMeters": 2.1,
                "kalmanFiltered": True,
                "batteryVoltage": 4.02,
                "batteryPercent": 87,
                "status": "AVAILABLE",
                "fatigueScore": 29,
                "relayedReportsCount": 7
            }
        }
        await broadcast_to_clients(json.dumps(telem_msg))
        logger.info(f"{Fore.BLUE}[MOCK LoRa Telemetry]{Style.RESET_ALL} SAR-01 update sent to {len(connected_clients)} client(s)")


async def websocket_handler(websocket, path=None):
    """Handles incoming WebSocket connections from the Web Dashboard."""
    connected_clients.add(websocket)
    client_ip = websocket.remote_address
    logger.info(f"{Fore.GREEN}Dashboard client connected: {client_ip}{Style.RESET_ALL} (Total: {len(connected_clients)})")

    # Send current gateway status immediately upon connection
    await websocket.send(json.dumps({
        "type": "GATEWAY_STATUS",
        "connected": serial_conn is not None and serial_conn.is_open,
        "port": active_port_name or "NONE",
        "timestamp": time.time()
    }))

    try:
        async for message in websocket:
            try:
                cmd_data = json.loads(message)
                logger.info(f"{Fore.YELLOW}[Dashboard Command Received]{Style.RESET_ALL} {message}")
                
                # Forward command to gateway serial connection
                if serial_conn and serial_conn.is_open:
                    serial_conn.write((message + "\n").encode("utf-8"))
                    serial_conn.flush()
                    await websocket.send(json.dumps({
                        "type": "DOWNLINK_ACK",
                        "status": "FORWARDED_TO_GATEWAY",
                        "timestamp": time.time()
                    }))
                else:
                    logger.warning("Received dispatch command, but Gateway serial port is not connected!")
                    await websocket.send(json.dumps({
                        "type": "DOWNLINK_ACK",
                        "status": "SERIAL_PORT_OFFLINE",
                        "timestamp": time.time()
                    }))

            except json.JSONDecodeError:
                logger.error(f"Malformed JSON from dashboard client: {message}")

    except ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Dashboard client disconnected: {client_ip} (Remaining: {len(connected_clients)})")


async def main():
    parser = argparse.ArgumentParser(description="SALBAR Gateway Serial-to-WebSocket Bridge")
    parser.add_argument("--port", type=str, default=None, help="Serial COM port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate (default: 115200)")
    parser.add_argument("--ws-port", type=int, default=8080, help="WebSocket port (default: 8080)")
    parser.add_argument("--mock", action="store_true", help="Run with simulated LoRa packets")
    args = parser.parse_args()

    port = args.port
    if not args.mock and not port:
        port = find_esp32_port()
        if not port:
            logger.warning(f"{Fore.RED}No active COM port detected!{Style.RESET_ALL}")
            logger.info("Falling back to --mock simulation mode. Pass --port COMx to specify manually.")
            args.mock = True
        else:
            logger.info(f"Auto-detected ESP32 serial port: {Fore.GREEN}{port}{Style.RESET_ALL}")

    # Start WebSocket server
    ws_server = await serve(websocket_handler, "0.0.0.0", args.ws_port)
    logger.info(f"{Fore.GREEN}✓ WebSocket server started at ws://localhost:{args.ws_port}{Style.RESET_ALL}")

    # Start either real serial reader or mock generator
    if args.mock:
        asyncio.create_task(mock_generator_task())
    else:
        asyncio.create_task(serial_reader_task(port, args.baud))

    try:
        await asyncio.Future()  # run forever
    except asyncio.CancelledError:
        pass
    finally:
        ws_server.close()
        await ws_server.wait_closed()
        if serial_conn and serial_conn.is_open:
            serial_conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\nShutting down SALBAR Serial Bridge...")
