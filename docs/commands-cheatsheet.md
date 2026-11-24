# SALBAR Command Cheat Sheet

Quick reference for running, flashing, and testing the Increment 1 hardware and software on Windows (PowerShell).

## Ports

| Device | Port | How to recognize it in `pio device list` |
| :--- | :--- | :--- |
| Gateway (LILYGO T3-S3) | `COM9` | "USB Serial Device" (VID:PID 303A:1001) |
| Field terminal (TTGO T-Beam) | `COM10` | "USB-Enhanced-SERIAL CH9102" |

Port numbers can differ between laptops or after replugging. Check with:

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device list
```

## Running the System (3 Terminals)

### Terminal 1: Serial bridge (gateway to dashboard)

```powershell
cd C:\SALBAR\services\serial-bridge
python bridge.py --port COM9
```

### Terminal 2: Web dashboard

```powershell
cd C:\SALBAR\apps\web-dashboard
npm run dev
```

Open `http://localhost:5173` in a browser.

### Terminal 3: T-Beam handheld screen (serial monitor)

```powershell
cd C:\SALBAR\firmware\field-terminal
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" device monitor -p COM10 -b 115200 --filter direct
```

Press `H` to draw the screen. The screen only redraws on key presses and events, so it starts blank if the board booted before the monitor was opened.

Press `Ctrl+C` to stop any of the three.

## Flashing Firmware

Only one program can use a COM port at a time. Stop the bridge before flashing the gateway (COM9), and close the serial monitor before flashing the T-Beam (COM10).

### T-Beam (field terminal)

```powershell
cd C:\SALBAR\firmware\field-terminal
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e tbeam_sx1276 -t upload --upload-port COM10
```

### T3-S3 (gateway)

```powershell
cd C:\SALBAR
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e t3s3_sx1262 -t upload --upload-port COM9
```

If the gateway upload fails to connect, enter bootloader mode: hold **BOOT**, tap **RST**, release **BOOT**, then run the command again. Tap **RST** once after flashing to start the new firmware.

## T-Beam Keys (Serial Monitor)

| Key | Physical button | Action |
| :--- | :--- | :--- |
| `1` | Button 1 (GPIO 13) | Open triage menu / move up |
| `2` | Button 2 (GPIO 14) | Open triage menu / move down |
| `3` or Enter | Button 3 (GPIO 15) | Select / confirm. On the confirm screen, **sends** the incident over LoRa |
| `4` or `B` | Button 4 (GPIO 25) | Back one menu level |
| `T` | - | Send telemetry immediately |
| `I` | - | Send a quick critical SOS test incident |
| `H` | - | Redraw the screen |

Sending a report: `1` (open menu) → `3` (choose category) → `3` (choose urgency) → `3` (send).

## GPS Status Reference

| Where | No fix yet | Fix acquired | GPS module problem |
| :--- | :--- | :--- | :--- |
| Bridge log | `GPS=ACQUIRING sats=N` | `GPS=FIX Lat=... Lng=... +/-Xm sats=N` | `GPS=NO_DATA (module silent)` |
| Dashboard | Amber chip `SAR-01: GPS ACQUIRING`, no pin | Chip disappears, SAR-01 pin on map | Red chip `GPS MODULE NOT RESPONDING` |
| T-Beam screen | `GPS: ACQUIRING` | `GPS: FIX (LIVE GPS)` | `GPS: NO DATA` |

A first fix needs open sky (not indoors) and usually takes 5 to 15 minutes. Keep the GPS antenna facing up.

## Other Useful Commands

| Task | Command |
| :--- | :--- |
| Dashboard test without hardware | `cd C:\SALBAR\services\serial-bridge` then `python bridge.py --mock` |
| Install bridge dependencies | `cd C:\SALBAR\services\serial-bridge` then `pip install -r requirements.txt` |
| Install dashboard dependencies | `cd C:\SALBAR\apps\web-dashboard` then `npm install` |

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `Access is denied (COMx)` / port busy | Another program (bridge, serial monitor, Arduino IDE) has the port open. Close it with `Ctrl+C`. |
| `Not a PlatformIO project` | Wrong folder. Gateway: `C:\SALBAR`. T-Beam: `C:\SALBAR\firmware\field-terminal`. |
| `[36m`-style codes in the T-Beam screen | The terminal does not support ANSI colors. Use Windows Terminal or the VS Code terminal, or add `--filter nocontrol`. |
| T-Beam screen lines wrap / box broken | Widen or maximize the terminal window (at least 70 columns). |
| Gateway not detected / Windows error 31 | Tap **RST** on the T3-S3 or replug its USB-C cable. |
| No telemetry in the bridge | Check the T-Beam power switch is on and its screen shows `SX1276 online`. |

Always attach the 915 MHz antennas to both boards before powering them on.
