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
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Set, Any

import colorama
from colorama import Fore, Style
import serial
import serial.tools.list_ports

try:
    from websockets.asyncio.server import serve, ServerConnection  # type: ignore
    from websockets.exceptions import ConnectionClosed  # type: ignore
    import websockets.http11
    # Increase HTTP header size and count limits to prevent HTTP 431 errors
    # caused by accumulated browser localhost cookies/session tokens.
    websockets.http11.MAX_LINE_LENGTH = 65536
    websockets.http11.MAX_NUM_HEADERS = 512
    WebSocketType = ServerConnection
except ImportError:
    import websockets  # type: ignore
    from websockets.exceptions import ConnectionClosed  # type: ignore
    if hasattr(websockets, "http11"):
        websockets.http11.MAX_LINE_LENGTH = 65536
        websockets.http11.MAX_NUM_HEADERS = 512
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
client_locks: dict[Any, asyncio.Lock] = {}

# Global serial handle & mode
serial_conn = None
active_port_name = None
is_mock_mode = False


# Increment 1 field-test log. Every incident received becomes one row of
# test_log.tsv; the file is rewritten each time with a summary at the bottom,
# so it can be pasted into Google Sheets as is (no formulas needed).
TEST_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_log.tsv")
TEST_LOG_HEADER = ["#", "Time sent", "Report", "Delay (s)", "RSSI (dBm)", "GPS", "Position (lat, lng)",
                   "GPS +/- (m)", "Distance (m)", "On dashboard", "Result", "Location / notes"]

# Gateway position for the distance column; set with --gateway-pos and remembered in this file.
GATEWAY_POS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gateway_pos.txt")
gateway_pos = None          # (lat, lng)
last_gps_accuracy_m = None  # latest Kalman accuracy from telemetry
last_incident_num = None    # to spot reports that never arrived
LAST_KNOWN_PASS_S = 120     # a last-known position up to this old still counts as PASS


def haversine_m(lat1, lng1, lat2, lng2):
    """Great-circle distance in meters."""
    import math
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(a))


def parse_latlng(text: str):
    lat_s, lng_s = text.replace(" ", "").split(",")
    return float(lat_s), float(lng_s)


def sent_time_from_gps(sent_utc_ms, received_utc: datetime):
    """Turn the T-Beam's GPS 'ms since UTC midnight' stamp into a local datetime and a delay in seconds."""
    if not isinstance(sent_utc_ms, (int, float)):
        return None, None
    midnight = received_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    sent_utc = midnight + timedelta(milliseconds=sent_utc_ms)
    # Send just before UTC midnight, received just after
    if sent_utc - received_utc > timedelta(hours=12):
        sent_utc -= timedelta(days=1)
    delay = (received_utc - sent_utc).total_seconds()
    if abs(delay) > 300:  # stale GPS time or a badly set laptop clock: don't report nonsense
        return None, None
    return sent_utc.astimezone(), delay


def _read_test_rows():
    """Data rows already in test_log.tsv (header and summary skipped)."""
    rows = []
    if os.path.exists(TEST_LOG_PATH):
        with open(TEST_LOG_PATH, encoding="utf-8") as f:
            lines = f.read().splitlines()
        for line in lines[1:]:
            if not line.strip():
                break  # blank line separates the summary
            rows.append(line.split("\t"))
    return rows


def _summary_rows(rows):
    def nums(col):
        out = []
        for r in rows:
            try:
                out.append(float(r[col]))
            except (ValueError, IndexError):
                pass
        return out

    def fmt(v, d=2):
        return f"{v:.{d}f}" if v is not None else "-"

    sent = len(rows)
    received = sum(1 for r in rows if r[10] != "FAIL - not received")
    passed = sum(1 for r in rows if r[10].startswith("PASS"))
    delays, rssis, dists = nums(3), nums(4), nums(8)
    return [
        ["Summary", "Reports sent", str(sent)],
        ["", "Reports received", str(received)],
        ["", "Packet delivery rate", f"{(received / sent * 100) if sent else 0:.0f}%"],
        ["", "Average delay (s)", fmt(sum(delays) / len(delays) if delays else None)],
        ["", "Max delay (s)", fmt(max(delays) if delays else None)],
        ["", "Average RSSI (dBm)", fmt(sum(rssis) / len(rssis) if rssis else None, 0)],
        ["", "Max distance (m)", fmt(max(dists) if dists else None, 1)],
        ["", "Tests passed", f"{passed} / {sent}"],
    ]


def _write_test_log(rows):
    with open(TEST_LOG_PATH, "w", encoding="utf-8", newline="") as f:
        f.write("\t".join(TEST_LOG_HEADER) + "\n")
        for r in rows:
            f.write("\t".join(r) + "\n")
        f.write("\n")
        for r in _summary_rows(rows):
            f.write("\t".join(r) + "\n")


def note_telemetry_accuracy(payload: dict):
    global last_gps_accuracy_m
    acc = payload.get("accuracyMeters")
    if payload.get("gpsFix") is not False and isinstance(acc, (int, float)):
        last_gps_accuracy_m = acc


def record_test_row(data: dict, inc_data: dict, dashboard_clients: int):
    """Add an incident to test_log.tsv and print it as a test card."""
    global last_incident_num
    try:
        rows = _read_test_rows()

        # Incident numbers count up on the T-Beam; a gap means reports were lost on the way.
        try:
            inc_num = int(str(inc_data.get("id", "")).rsplit("-", 1)[-1])
        except ValueError:
            inc_num = None
        if inc_num is not None and last_incident_num is not None and inc_num > last_incident_num + 1:
            for _ in range(min(inc_num - last_incident_num - 1, 20)):
                rows.append([str(len(rows) + 1), "-", "-", "", "", "", "", "", "", "-", "FAIL - not received", ""])
                print(f"{Fore.RED}TEST #{len(rows)}: report sent but NOT RECEIVED (lost){Style.RESET_ALL}", flush=True)
        if inc_num is not None:
            last_incident_num = inc_num

        now_utc = datetime.now(timezone.utc)
        sent_local, delay = sent_time_from_gps(inc_data.get("sentUtcMs"), now_utc)
        rssi = data.get("rssi")
        lat, lng = inc_data.get("lat"), inc_data.get("lng")
        has_pos = lat is not None and lng is not None
        source = inc_data.get("positionSource") or ("live" if has_pos else "none")
        age_s = inc_data.get("positionAgeS") or 0
        live = source == "live" and has_pos
        on_dashboard = dashboard_clients > 0
        gps_label = "LIVE" if live else (f"LAST {age_s}s" if has_pos else "NONE")

        if not on_dashboard:
            result = "FAIL - dashboard not open"
        elif live:
            result = "PASS"
        elif has_pos and age_s <= LAST_KNOWN_PASS_S:
            result = "PASS (last known)"
        elif has_pos:
            result = "FAIL - position too old"
        else:
            result = "FAIL - no GPS position"

        row = [
            str(len(rows) + 1),
            (sent_local or now_utc.astimezone()).strftime("%Y-%m-%d %H:%M:%S"),
            f"{inc_data.get('category', '')} / {inc_data.get('urgency', '')}",
            f"{delay:.2f}" if delay is not None else "",
            f"{rssi:.0f}" if isinstance(rssi, (int, float)) else "",
            gps_label,
            f"{lat:.6f}, {lng:.6f}" if has_pos else "NONE",
            f"{last_gps_accuracy_m:.1f}" if live and last_gps_accuracy_m is not None else "",
            f"{haversine_m(gateway_pos[0], gateway_pos[1], lat, lng):.1f}" if has_pos and gateway_pos else "",
            "Yes" if on_dashboard else "No",
            result,
            "",
        ]
        rows.append(row)
        _write_test_log(rows)

        color = Fore.GREEN if result.startswith("PASS") else Fore.RED
        print(
            f"{color}+---------------- TEST #{row[0]}: {result} ----------------+\n"
            f"| Sent      : {row[1]}\n"
            f"| Report    : {row[2]}\n"
            f"| Delay     : {row[3] + ' s' if row[3] else '-- (no GPS time)'}\n"
            f"| RSSI      : {row[4]} dBm\n"
            f"| GPS       : {row[5]}\n"
            f"| Position  : {row[6]}{'  +/-' + row[7] + ' m' if row[7] else ''}\n"
            f"| Distance  : {row[8] + ' m from gateway' if row[8] else '-- (no position or --gateway-pos not set)'}\n"
            f"| Dashboard : {row[9]}\n"
            f"+-----------------------------------------------------+{Style.RESET_ALL}",
            flush=True,
        )
    except Exception as ex:  # never let test logging break the bridge
        logger.warning(f"Could not write test log: {ex}")


async def safe_send(ws: WebSocketType, message: str):
    """Safely send a message to a client using a per-connection lock to prevent ConcurrencyError."""
    lock = client_locks.setdefault(ws, asyncio.Lock())
    async with lock:
        await ws.send(message)


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
        return 0
    disconnected = set()
    for ws in list(connected_clients):
        try:
            await safe_send(ws, message)
        except Exception:
            disconnected.add(ws)
    connected_clients.difference_update(disconnected)
    for ws in disconnected:
        client_locks.pop(ws, None)
    return len(connected_clients)


async def serial_reader_task(port: str, baud: int):
    """Continuously read lines from the gateway serial port and broadcast."""
    global serial_conn, active_port_name
    active_port_name = port

    while True:
        try:
            logger.info(f"{Fore.YELLOW}Opening serial connection to {port} @ {baud} baud...{Style.RESET_ALL}")
            serial_conn = serial.Serial(port, baudrate=baud, timeout=1.0, write_timeout=1.0)
            try:
                serial_conn.dtr = True
            except Exception:
                pass
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
                        payload = data.get("data", {})
                        lat = payload.get("lat")
                        lng = payload.get("lng")
                        batt = payload.get("batteryPercent")
                        sats = payload.get("satellites")
                        if payload.get("gpsFix") is False:
                            if payload.get("gpsModuleOk") is False:
                                coords_str = f" Lat=---------- Lng=----------- {Fore.RED}GPS=NO_DATA (module silent){Style.RESET_ALL}"
                            else:
                                in_view = payload.get("satellitesInView")
                                trk = payload.get("satellitesTracked")
                                strong = payload.get("satellitesStrong")
                                max_snr = payload.get("maxSnr")
                                sig_str = f" tracked={trk} strong={strong} best_snr={max_snr}dB" if trk is not None else ""
                                if payload.get("rxFixMode") is not None:
                                    mode_names = {0: "?", 1: "NONE", 2: "2D", 3: "3D"}
                                    sig_str += (f" module_fix={mode_names.get(payload.get('rxFixMode'), '?')}"
                                                f" rmc={'A' if payload.get('rxRmcValid') else 'V'}"
                                                f" gga_q={payload.get('rxGgaQuality')}")
                                if payload.get("ubxReply") is False:
                                    sig_str += f" {Fore.RED}ubx=NO_REPLY{Style.RESET_ALL}{Fore.YELLOW}"
                                elif payload.get("ubxEphemeris") is not None:
                                    sig_str += (f" eph={payload.get('ubxEphemeris')}"
                                                f" locked={payload.get('ubxLocked')}"
                                                f" used={payload.get('ubxUsed')}")
                                coords_str = f" Lat=---------- Lng=----------- {Fore.YELLOW}GPS=ACQUIRING in_view={in_view}{sig_str}{Style.RESET_ALL}"
                        elif lat is not None and lng is not None:
                            acc = payload.get("accuracyMeters")
                            acc_str = f" +/-{acc:.1f}m" if acc is not None else ""
                            in_view = payload.get("satellitesInView")
                            sats_str = f" sats={sats}/{in_view}" if sats is not None else ""
                            coords_str = f" Lat={Fore.GREEN}{lat:.6f}{Style.RESET_ALL} Lng={Fore.GREEN}{lng:.6f}{Style.RESET_ALL} {Fore.GREEN}GPS=FIX{Style.RESET_ALL}{acc_str}{sats_str}"
                        else:
                            coords_str = ""
                        note_telemetry_accuracy(payload)
                        batt_str = f" Batt={batt}%" if batt is not None else ""
                        logger.info(f"{Fore.BLUE}[LoRa Telemetry]{Style.RESET_ALL} Node={Fore.WHITE}{node}{Style.RESET_ALL} RSSI={rssi}dBm{coords_str}{batt_str}")
                    elif msg_type == "INCIDENT":
                        inc_data = data.get("data", {})
                        inc_id = inc_data.get("id", "???")
                        urgency = inc_data.get("urgency", "???")
                        if inc_data.get("gpsFix") is False:
                            loc_str = f" {Fore.YELLOW}Location=NO_GPS_FIX{Style.RESET_ALL}"
                        elif inc_data.get("lat") is not None:
                            loc_str = f" Lat={inc_data['lat']:.6f} Lng={inc_data['lng']:.6f}"
                        else:
                            loc_str = ""
                        category = inc_data.get("category", "???")
                        rssi = data.get("rssi")
                        rssi_str = f" RSSI={rssi:.0f}dBm" if isinstance(rssi, (int, float)) else ""
                        logger.info(f"{Fore.RED}[LoRa Incident!]{Style.RESET_ALL} ID={inc_id} Category={category} Urgency={Fore.RED}{urgency}{Style.RESET_ALL}{rssi_str}{loc_str}")
                    else:
                        logger.info(f"{Fore.MAGENTA}[Gateway Msg]{Style.RESET_ALL} {raw_str}")

                    # Forward directly to web dashboard
                    delivered = await broadcast_to_clients(raw_str)
                    if msg_type == "INCIDENT":
                        record_test_row(data, data.get("data", {}), delivered or 0)

                except json.JSONDecodeError:
                    # Non-JSON or debug message from ESP32
                    logger.info(f"{Fore.LIGHTBLACK_EX}[RAW SERIAL]{Style.RESET_ALL} {raw_str}")

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
    # Send initial telemetry after a brief delay
    await asyncio.sleep(1)
    while True:
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
        await asyncio.sleep(5)


async def websocket_handler(websocket, path=None):
    """Handles incoming WebSocket connections from the Web Dashboard."""
    connected_clients.add(websocket)
    client_ip = websocket.remote_address
    logger.info(f"{Fore.GREEN}Dashboard client connected: {client_ip}{Style.RESET_ALL} (Total: {len(connected_clients)})")

    # Send current gateway status immediately upon connection
    await safe_send(websocket, json.dumps({
        "type": "GATEWAY_STATUS",
        "connected": is_mock_mode or (serial_conn is not None and serial_conn.is_open),
        "port": "MOCK_VIRTUAL_T3S3" if is_mock_mode else (active_port_name or "NONE"),
        "timestamp": time.time()
    }))

    try:
        async for message in websocket:
            try:
                cmd_data = json.loads(message)
                logger.info(f"{Fore.YELLOW}[Dashboard Command Received]{Style.RESET_ALL} {message}")
                
                # Forward command to gateway serial connection
                if serial_conn and serial_conn.is_open:
                    try:
                        serial_conn.write((message + "\n").encode("utf-8"))
                    except Exception as ex:
                        logger.error(f"Error writing to gateway serial: {ex}")
                    await safe_send(websocket, json.dumps({
                        "type": "DOWNLINK_ACK",
                        "status": "FORWARDED_TO_GATEWAY",
                        "timestamp": time.time()
                    }))
                elif is_mock_mode:
                    logger.info(f"{Fore.GREEN}[MOCK LoRa Downlink Transmitted]{Style.RESET_ALL} Downlink sent over simulated RF to {cmd_data.get('targetUnit')}")
                    await safe_send(websocket, json.dumps({
                        "type": "DOWNLINK_ACK",
                        "status": "FORWARDED_TO_GATEWAY_MOCK",
                        "timestamp": time.time()
                    }))
                else:
                    logger.warning("Received dispatch command, but Gateway serial port is not connected!")
                    await safe_send(websocket, json.dumps({
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
        client_locks.pop(websocket, None)
        logger.info(f"Dashboard client disconnected: {client_ip} (Remaining: {len(connected_clients)})")


async def main():
    global is_mock_mode
    parser = argparse.ArgumentParser(description="SALBAR Gateway Serial-to-WebSocket Bridge")
    parser.add_argument("--port", type=str, default=None, help="Serial COM port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate (default: 115200)")
    parser.add_argument("--ws-port", type=int, default=8080, help="WebSocket port (default: 8080)")
    parser.add_argument("--mock", action="store_true", help="Run with simulated LoRa packets")
    parser.add_argument("--gateway-pos", type=str, default=None,
                        help='Gateway location "lat,lng" for the test distance column (remembered for later runs)')
    args = parser.parse_args()

    global gateway_pos
    try:
        if args.gateway_pos:
            gateway_pos = parse_latlng(args.gateway_pos)
            with open(GATEWAY_POS_PATH, "w", encoding="utf-8") as f:
                f.write(f"{gateway_pos[0]},{gateway_pos[1]}\n")
        elif os.path.exists(GATEWAY_POS_PATH):
            with open(GATEWAY_POS_PATH, encoding="utf-8") as f:
                gateway_pos = parse_latlng(f.read().strip())
    except ValueError:
        logger.error('--gateway-pos must look like "10.299312,123.876501"')
        return
    if gateway_pos:
        logger.info(f"Gateway position for test distances: {gateway_pos[0]:.6f}, {gateway_pos[1]:.6f}")
    else:
        logger.warning('No gateway position set; test distance column stays empty. Use --gateway-pos "lat,lng"')

    port = args.port
    if not args.mock and not port:
        port = find_esp32_port()
        if not port:
            logger.warning(f"{Fore.RED}No active COM port detected!{Style.RESET_ALL}")
            logger.info("Falling back to --mock simulation mode. Pass --port COMx to specify manually.")
            args.mock = True
        else:
            logger.info(f"Auto-detected ESP32 serial port: {Fore.GREEN}{port}{Style.RESET_ALL}")

    is_mock_mode = args.mock

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
