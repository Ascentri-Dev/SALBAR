# Increment 1 hardware verification and GPS bring-up

Branch `develop` (all work uncommitted) · base `develop` · last commit `d7ca42f Merge pull request #7 from Ascentri-Dev/feat/increment-1` · updated 2026-11-22
Read this file first. It overrides older specs, plans and handoffs where they disagree.

## Status
- LoRa link T-Beam (SAR-01) to T3-S3 gateway works: telemetry every 10 s, incidents (bench SOS and the 4-button menu) arrive as JSON, bridge and dashboard receive them.
- GPS module (u-blox NEO-6M on T-Beam AXP2101 v1.2) streams NMEA and answers UBX commands, and got its **first fix on 2026-11-22 03:01** (3rd-floor balcony, gateway on 2nd floor indoors, RSSI -73 to -76 dBm). Ephemeris rose 1 to 3 over about 20 minutes, then fix with 4 to 5 satellites, +/-2.9 m, position spread about 5 m. Earlier failures were mostly too little time with weak signal (best SNR 28 to 37 dB-Hz).
- Fake Cebu fallback coordinates removed everywhere. Without a fix the terminal sends 0,0 with a "no fix" flag, the bridge logs `Lat=----------`, the dashboard shows an amber "GPS ACQUIRING" chip and no pin.
- New GPS diagnostics in telemetry: satellites in view / tracked / strong / best SNR, the module's own fix status (GSA/RMC/GGA), and u-blox NAV-SVINFO (ephemeris downloaded, locked, used).
- Gateway runs the latest firmware. T-Beam was flashed 2026-11-22 with the SH1106 OLED driver (user reports flash done; success output not seen by agent).
- Hardware wired on a full-size breadboard (see `docs/hardware-wiring-guide.md`): 4 buttons on GPIO 13/14/15/25 to GND, OLED on 3V3/GND/21 (SDA)/22 (SCK). T-Beam has **no header pins soldered**; male jumpers sit loose in bare holes.
- Buttons work after fixing a GPIO 15 short (it caused an incident every 2 s). OLED is a 1.3-inch SH1106 (pin order VCC GND SCK SDA): it lit up with one text line and noise under the SSD1306 driver. **Still not displaying correctly after the SH1106 firmware flash.** User paused here.
- Last indoor bridge log showed `in_view=0` (GPS saw no satellites). Not yet checked outdoors after wiring.
- Nothing committed.

## Next action
- Next (user, then agent): full power cycle (unplug USB, hold PWR 6 s), check what the OLED shows, send a photo and the flash output. Agent: if still wrong, add an I2C scan and OLED init result to the boot log, check `begin()` return and reset/offset handling for SH1106.
- Then (user): run the 10 incident tests with buttons and record them in the table in `docs/hardware-wiring-guide.md` (teacher requirement). Agent fills delays and GPS errors from pasted logs.
- Meanwhile (agent): nothing blocking; could prepare the I2C scan code.

## Decisions
- 2026-11-21: Button 4 on the T-Beam is Back, not Send. Send is Button 3 on the confirm screen. User requested it.
- 2026-11-21: Never transmit or display fallback coordinates. No fix means lat/lng 0,0 plus a flag, no map pin. A wrong pin misleads operators and the panel.
- 2026-11-21: Telemetry payload extended with GPS diagnostic bytes (see protocol). Both boards must run matching firmware.
- 2026-11-21: Unit pins stay visible only under the HANDHELD DEVICES KPI filter (teammate's design), but the GPS status chip shows in every view.
- 2026-11-22: Incidents without a live fix now carry the last-known real position plus its age (`pos_age_s`; 0 = live, 0xFFFF = none). Dashboard shows a faded dashed pin labeled "Last known position, N s old". Still no fake coordinates. Live window raised 5 s to 15 s; jump filter holds readings >100 m (+3 m/s x gap) away until 5 consistent readings; HDOP > 5 ignored. Bridge test log: LIVE = PASS, last known <= 120 s = PASS (last known).
- 2026-11-22: PCF8574T expander not used. Buttons read GPIO directly; OLED is native I2C. Simpler, fewer failure points.
- 2026-11-22: OLED driver changed from Adafruit SSD1306 to Adafruit SH110X (`Adafruit_SH1106G`, `begin(0x3C, true)`), because the module is SH1106.
- 2026-11-21: Accuracy estimate (HDOP x 2.5 into Kalman) left as is for now. Better approach later: UBX hAcc plus logged raw vs filtered error for the GPS accuracy evaluation.

## Code map
- `firmware/field-terminal/src/main.cpp`: T-Beam firmware. GPS helpers `gpsHasFix()` (fresh fix < 5 s), GSV signal parser, UBX parser and NAV-SVINFO poll every 5 s, GSV enable at boot (`$PUBX,40` and `$PCAS03`), 2048-byte GPS RX buffer, serial key `R` = GPS factory reset (UBX CFG-CFG + hot restart), screen redraw on GPS state change.
- `firmware/field-terminal/platformio.ini`: lib `adafruit/Adafruit SH110X @ ^2.1.10` replaces Adafruit SSD1306.
- `docs/hardware-wiring-guide.md`: breadboard wiring, first power-up checks, 10-test procedure and table.
- `firmware/field-terminal/src/pins_config.h`: GPIO 25 comment now "Back".
- `firmware/shared/include/salbar_protocol.h`: `SalbarTelemetryPayload` gained `sats_in_view`, `sats_tracked`, `sats_strong`, `max_snr`, `gps_receiver`, `ubx_eph`, `ubx_locked`, `ubx_used`. `flags` bit 0 = fix, bit 1 = module streaming, bits 2 to 7 = satellites used.
- `firmware/gateway/src/main.cpp`: emits `gpsFix`, `gpsModuleOk`, `satellites*`, `maxSnr`, `rxFixMode`, `rxRmcValid`, `rxGgaQuality`, `ubxEphemeris/ubxLocked/ubxUsed` or `ubxReply:false`. Omits lat/lng when there is no fix (telemetry and incidents).
- `services/serial-bridge/bridge.py`: log line shows coordinates or `Lat=----------`, GPS state, signal and UBX fields.
- `apps/web-dashboard/src/`: `types/cad.ts`, `hooks/useGatewayBridge.ts`, `screens/CommandMapScreen/CommandMapScreen.tsx`, `components/map/TacticalMap.tsx` (no pins at 0,0, GPS status chip top-left), `data/mockCadData.ts` (seed SAR-01 has no position).
- `docs/commands-cheatsheet.md`: all run, flash and key commands. `docs/increment-1-guide.md`: section 9 updated for Back button.

## Verified vs assumed
- Verified: ports on this laptop are COM9 = T3-S3 gateway, COM10 = T-Beam (`pio device list`).
- Verified: gateway receives telemetry and incidents with valid CRC (raw COM9 JSON read in session).
- Verified: GPS module sends NMEA at 9600 baud with 0 checksum errors; replies to UBX NAV-SVINFO (`UBX: EPHEMERIS 0 | LOCKED 0 | USED 0 | CH 16` indoors).
- Verified: module reports `module_fix=NONE rmc=V gga_q=0` outdoors with 4 to 6 strong satellites (bridge logs 2026-11-21 16:22 to 16:29).
- Verified: dashboard type-checks clean (`npx tsc -p tsconfig.app.json --noEmit`); dashboard mock mode shows pin and auto-zoom (user confirmed).
- Verified: T-Beam firmware with SH110X builds (`pio run -e tbeam_sx1276`, SUCCESS 2026-11-22).
- Verified: GPIO 15 held LOW caused repeated CRITICAL incidents; removing the wire stopped it (user test).
- Verified (photo): OLED module labeled VCC GND SCK SDA, 1.3-inch, first text row drawn, rest noise under SSD1306 driver.
- Assumed: the OLED is SH1106 (not SSD1309 or another controller). Not proven; SH1106 flash did not fix it yet.
- Assumed: the GPS factory reset (`R`) was applied by the module (no ACK was read).
- Assumed: the small GPS patch antenna is the main limit. Not proven.
- Assumed: whether the u.FL GPS connector supplies bias voltage for an active antenna. Not measured.

## To-do
Before Increment 1 checking:
- Fix the OLED display (user power cycle and report, then agent). 
- Solder header pins on the T-Beam; bare-hole jumpers cause shorts and dropouts (user).
- Run and record the 10 tests (user, agent fills table). blocked by: OLED fix (optional, serial screen works).
- Recheck GPS outdoors after wiring (`in_view=0` indoors) (user).
- ~~Flash gateway with latest firmware~~ Done 2026-11-22.
- ~~Outdoor test with NAV-SVINFO data~~ Done 2026-11-22, first fix.
- If the antenna is the limit: measure DC voltage on the GPS u.FL center pin, then buy an active 1575 MHz GPS antenna (or passive + bias tee) (user).
- Possible agent tool: cold-start key (UBX CFG-RST with full BBR clear) if stale stored data is suspected (agent).
- Multilingual EN/TL/CEB dataset is missing from the repo; Increment 1 requires it (user, ask teammate).
- Wire the 4 physical buttons on the breadboard (user).
Housekeeping:
- Commit this work on a feature branch, not `develop` (agent, when user asks).
- `docs/README.md` link to `increment-1-guide.md` points at a teammate's absolute path (`C:/Users/JM/...`); change to relative (agent, ask first).
- Increment 1 guide still lists COM5/COM6 and lacks `--upload-port`; cheatsheet has the correct commands (agent).
- Battery reads 0 mV: 18650 holder is empty; T-Beam runs from a power bank (user).

## Open questions
- Is the GPS patch antenna or the NEO-6M module at fault? Waiting on the NAV-SVINFO outdoor log (user).
- Budget and timing for an external active GPS antenna (user).

## Gotchas
- Only one program can open a COM port. Stop the bridge before flashing the gateway, close the serial monitor before flashing the T-Beam.
- Gateway flashes from `C:\SALBAR` (env `t3s3_sx1262`); T-Beam from `C:\SALBAR\firmware\field-terminal` (env `tbeam_sx1276`). Always pass `--upload-port`.
- The T-Beam serial screen only redraws on events or keys; press `H`. Use Windows Terminal or VS Code terminal for ANSI colors.
- The GPS antenna is the small patch with black foam tape on the battery-holder side, connected by a thin u.FL cable. It came unstuck once; keep it flat and facing the sky (battery side up). Do not peel the tape.
- `sats` in the log is satellites used in a fix and stays 0 until a fix; `in_view` / `tracked` / `strong` show progress.
- The T-Beam has its own pin labeled SCK (GPIO 5, LoRa clock). OLED SCK goes to pin 22, not that one.
- Plugging USB into the T-Beam (AXP2101) powers it on automatically. Hold PWR about 6 s to turn off. It charges while on or off.
- The firmware only probes the OLED once at boot; reboot after fixing OLED wires.
- Do not put wires in GPIO 12 or 34 (GPS UART).
- Changing `SalbarTelemetryPayload` requires reflashing both boards.

## Related docs
- `docs/Approval-Sheet.pdf`: Increment 1 scope (current).
- `docs/increment-1-guide.md`: teammate's guide, current except ports and flashing notes.
- `docs/commands-cheatsheet.md`: current command reference.
- `docs/hardware-wiring-guide.md`: current wiring guide and test table (OLED section says SSD1306; module is actually SH1106).

## Session log
- 2026-11-22 (later): Wired buttons and 1.3-inch OLED on breadboard without T-Beam headers; fixed GPIO 15 short; switched firmware to SH1106 driver (builds, flashed by user) but OLED still wrong. Wrote docs/hardware-wiring-guide.md. No commits.
- 2026-11-22: Flashed gateway; NAV-SVINFO showed eph stuck at 1 with weak SNR; T-Beam on 3rd-floor balcony got first GPS fix at 03:01 (10.2993, 123.8765, +/-2.9 m). No commits.
- 2026-11-21 to 2026-11-22: Verified LoRa link and incident path; changed Button 4 to Back; removed fallback coordinates end to end; added GPS status chip, signal (GSV SNR), module fix status, factory reset and NAV-SVINFO diagnostics; GPS still has no fix outdoors. No commits.
