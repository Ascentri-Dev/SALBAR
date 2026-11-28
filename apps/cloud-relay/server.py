#!/usr/bin/env python3
"""
SALBAR Cloud Relay Ingestion Service (`apps/cloud-relay`)
Lightweight HTTP endpoint receiving resident emergency reports from `apps/mobile`
when internet/Wi-Fi connectivity is available, deduplicating by report UUID, and
forwarding live incidents to the host WebSocket bridge (`ws://localhost:8080`).
"""

import argparse
import json
import logging
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Deque, Dict, Set

from colorama import Fore, Style, init as colorama_init

try:
    from websockets.sync.client import connect as ws_connect
except ImportError:
    ws_connect = None  # type: ignore

colorama_init(autoreset=True)

logging.basicConfig(
    level=logging.INFO,
    format=f"{Fore.CYAN}%(asctime)s{Style.RESET_ALL} [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("SALBAR-CloudRelay")

BRIDGE_WS_URL = "ws://localhost:8080"
MAX_CACHED_INCIDENTS = 500

state_lock = threading.Lock()
seen_ids: Set[str] = set()
cached_incidents: Deque[Dict[str, Any]] = deque(maxlen=MAX_CACHED_INCIDENTS)


def to_dashboard_envelope(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a mobile Cloud Relay report into the Web Dashboard INCIDENT envelope."""
    report_uuid = str(payload["id"])
    inc_num = payload.get("incidentIdNum")
    short_id = f"MOB-{inc_num}" if inc_num else f"MOB-{report_uuid[:6].upper()}"

    lat = payload.get("lat")
    lng = payload.get("lng")
    has_fix = isinstance(lat, (int, float)) and isinstance(lng, (int, float)) and (lat != 0 or lng != 0)
    pos_age_s = payload.get("posAgeS", 65535)

    data_block: Dict[str, Any] = {
        "id": short_id,
        "reportUuid": report_uuid,
        "urgency": payload.get("urgency", "HIGH"),
        "category": payload.get("category", "trapped-persons"),
        "source": "CLOUD_RELAY",
        "victimCount": int(payload.get("victimCount", 1)),
        "rawText": str(payload.get("rawText", "")),
        "gpsFix": has_fix,
    }

    if has_fix:
        data_block["lat"] = float(lat)
        data_block["lng"] = float(lng)
        if isinstance(pos_age_s, (int, float)) and 0 < pos_age_s < 65535:
            data_block["positionSource"] = "last-known"
            data_block["positionAgeS"] = int(pos_age_s)

    return {
        "type": "INCIDENT",
        "srcNode": "MOBILE",
        "timestamp": time.time(),
        "data": data_block,
    }


def forward_to_bridge(envelope: Dict[str, Any], ws_url: str) -> bool:
    """Sends an INCIDENT envelope to the running serial-bridge WebSocket server."""
    if ws_connect is None:
        logger.warning("websockets.sync.client unavailable; incident cached only.")
        return False
    try:
        with ws_connect(ws_url, open_timeout=2.0, close_timeout=1.0) as ws:
            ws.send(json.dumps(envelope))
        return True
    except Exception as exc:
        logger.warning(f"Bridge WS unreachable ({ws_url}): {exc}. Cached in relay.")
        return False


class CloudRelayHandler(BaseHTTPRequestHandler):
    bridge_ws_url = BRIDGE_WS_URL

    def log_message(self, format: str, *args: Any) -> None:
        # Suppress default stderr HTTP logging in favor of structured logger
        return

    def _send_json(self, status_code: int, body: Any) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        if self.path == "/health":
            with state_lock:
                count = len(cached_incidents)
            self._send_json(200, {"status": "ok", "cached": count})
            return

        if self.path == "/api/v1/incidents":
            with state_lock:
                items = list(cached_incidents)
            self._send_json(200, {"incidents": items})
            return

        self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path != "/api/v1/incidents":
            self._send_json(404, {"error": "Not found"})
            return

        content_len = int(self.headers.get("Content-Length", "0"))
        if content_len <= 0 or content_len > 65536:
            self._send_json(400, {"error": "Invalid Content-Length"})
            return

        try:
            raw_body = self.rfile.read(content_len)
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            self._send_json(400, {"error": "Malformed JSON"})
            return

        report_id = payload.get("id")
        category = payload.get("category")
        urgency = payload.get("urgency")
        if not report_id or not category or not urgency:
            self._send_json(400, {"error": "Missing required fields: id, category, urgency"})
            return

        with state_lock:
            if report_id in seen_ids:
                logger.info(f"{Fore.YELLOW}[DUPLICATE]{Style.RESET_ALL} Ignored report {report_id}")
                self._send_json(409, {"status": "DUPLICATE", "id": report_id})
                return

            seen_ids.add(report_id)
            envelope = to_dashboard_envelope(payload)
            cached_incidents.appendleft(envelope)

        forwarded = forward_to_bridge(envelope, self.bridge_ws_url)
        inc_data = envelope["data"]
        logger.info(
            f"{Fore.GREEN}[CLOUD RELAY]{Style.RESET_ALL} "
            f"ID={inc_data['id']} Cat={category} Urgency={urgency} "
            f"ForwardedToBridge={forwarded}"
        )

        self._send_json(
            201,
            {
                "status": "ACCEPTED",
                "id": report_id,
                "dashboardId": inc_data["id"],
                "forwardedToBridge": forwarded,
            },
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="SALBAR Cloud Relay Ingestion Server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port (default: 8000)")
    parser.add_argument(
        "--bridge-ws",
        default=BRIDGE_WS_URL,
        help=f"WebSocket URL of serial-bridge (default: {BRIDGE_WS_URL})",
    )
    args = parser.parse_args()

    CloudRelayHandler.bridge_ws_url = args.bridge_ws
    server = ThreadingHTTPServer((args.host, args.port), CloudRelayHandler)
    logger.info(
        f"{Fore.GREEN}Cloud Relay listening on http://{args.host}:{args.port} "
        f"(forwarding to {args.bridge_ws}){Style.RESET_ALL}"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down Cloud Relay...")
        server.server_close()


if __name__ == "__main__":
    main()
